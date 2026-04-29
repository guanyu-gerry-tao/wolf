import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderServiceImpl } from '../impl/renderServiceImpl.js';
import { CannotFitError, CannotFillError } from '../impl/render/fit.js';
import { createSilentLogger } from '../../utils/logger.js';
import type { FitResult } from '../impl/render/fit.js';

const FAKE_PDF = Buffer.from('fake-pdf-bytes');

// Mock Playwright so tests don't need a real browser.
// page.pdf returns FAKE_PDF to support renderCoverLetterPdf tests.
// executablePath returns process.execPath (always-exists) so the render
// service's ensureChromium guard treats Chromium as installed and skips
// the npx auto-install branch.
vi.mock('playwright', () => ({
  chromium: {
    executablePath: () => process.execPath,
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        emulateMedia: vi.fn().mockResolvedValue(undefined),
        goto: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(undefined),
        pdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-bytes')),
        setViewportSize: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock the fit function so we can control its outcome without running Chromium.
vi.mock('../impl/render/fit.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../impl/render/fit.js')>();
  return { ...actual, fit: vi.fn() };
});

import { fit } from '../impl/render/fit.js';

// Alias for readability in cover letter test.
const mockFit = vi.mocked(fit);

describe('RenderService', () => {
  beforeEach(() => vi.clearAllMocks());

  // Happy path: fit succeeds and returns a PDF buffer.
  it('returns PDF buffer on success', async () => {
    vi.mocked(fit).mockResolvedValue({
      pdf: FAKE_PDF,
      finalParams: { fontSize: 11, lineHeight: 1.3, marginIn: 0.5, sectionGap: 0.85 },
      iterations: 3,
      trace: [],
    } as FitResult);

    const svc = new RenderServiceImpl();
    const result = await svc.renderPdf('<h2>Experience</h2>');
    expect(result).toEqual(FAKE_PDF);
    expect(fit).toHaveBeenCalledOnce();
  });

  // Overflow case: content too long to fit at minimum params — CannotFitError should bubble up.
  it('propagates CannotFitError when content is too long', async () => {
    const fakeResult: FitResult = {
      pdf: FAKE_PDF,
      finalParams: { fontSize: 9.5, lineHeight: 1.1, marginIn: 0.3, sectionGap: 0.85 },
      iterations: 12,
      trace: [],
    };
    vi.mocked(fit).mockRejectedValue(new CannotFitError(fakeResult));

    const svc = new RenderServiceImpl();
    await expect(svc.renderPdf('<h2>Too much content</h2>')).rejects.toThrow(CannotFitError);
  });

  // Underflow case: content too sparse to fill the page — CannotFillError should bubble up.
  it('propagates CannotFillError when content is too short', async () => {
    const fakeResult: FitResult = {
      pdf: FAKE_PDF,
      finalParams: { fontSize: 14, lineHeight: 1.3, marginIn: 0.5, sectionGap: 2 },
      iterations: 5,
      trace: [],
    };
    vi.mocked(fit).mockRejectedValue(new CannotFillError(fakeResult));

    const svc = new RenderServiceImpl();
    await expect(svc.renderPdf('<h2>Too little</h2>')).rejects.toThrow(CannotFillError);
  });

  // renderCoverLetterPdf: natural-layout render path. Cover letters do NOT
  // use the fit() loop — short content keeps its whitespace, long content
  // paginates naturally. See DECISIONS.md 2026-04-25.
  it('renderCoverLetterPdf returns pdf buffer at natural layout (no fit)', async () => {
    const svc = new RenderServiceImpl();
    const result = await svc.renderCoverLetterPdf('<p>Cover letter content</p>');
    expect(result).toEqual(FAKE_PDF);
    // fit() must NOT be called for cover letters — that was Bug B2.
    expect(mockFit).not.toHaveBeenCalled();
  });

  // Regression for Bug B2: a legitimately short cover letter must not bubble
  // up CannotFillError. Even if fit() would throw on this content, the
  // cover-letter path never reaches fit(), so the buffer comes back cleanly.
  it('renderCoverLetterPdf does not throw CannotFillError on short content', async () => {
    // Pre-arm fit() to throw — a regression to the old fit-based path would
    // hit this and surface the error. The natural path never calls it.
    const fakeShortAttempt: FitResult = {
      pdf: FAKE_PDF,
      finalParams: { fontSize: 14, lineHeight: 1.3, marginIn: 0.5, sectionGap: 2 },
      iterations: 5,
      trace: [],
    };
    mockFit.mockRejectedValue(new CannotFillError(fakeShortAttempt));

    const svc = new RenderServiceImpl();
    await expect(svc.renderCoverLetterPdf('<p>Short.</p>')).resolves.toEqual(FAKE_PDF);
    expect(mockFit).not.toHaveBeenCalled();
  });

  // The CannotFillError message must be user-actionable: name what
  // happened (too short), give concrete numbers from the last fit
  // attempt, and tell the user how to fix THEIR pool — never suggest
  // adding fabricated content. This is the contract that lets the CLI
  // surface error.message directly without a separate diagnostic layer.
  it('CannotFillError message tells the user the page did not fill and what to add to resume_pool.md', async () => {
    const attempt: FitResult = {
      pdf: FAKE_PDF,
      finalParams: { fontSize: 14, lineHeight: 1.3, marginIn: 0.5, sectionGap: 2 },
      iterations: 5,
      trace: [{ iter: 5, params: { fontSize: 14, lineHeight: 1.3, marginIn: 0.5, sectionGap: 2 }, scrollHeight: 580, pageHeightPx: 960 }],
    };
    const err = new CannotFillError(attempt);

    expect(err.message).toMatch(/too short/i);
    expect(err.message).toContain('580px');
    expect(err.message).toContain('960px');
    expect(err.message).toContain('60%');
    expect(err.message).toMatch(/resume_pool\.md/);
    // Must NOT positively instruct adding fabricated content. Phrasings
    // like "ask Claude to add filler" or "wolf will invent the rest" are
    // forbidden; "wolf will NOT fabricate" is fine — that's the policy
    // statement, not an instruction.
    expect(err.message).not.toMatch(/ask claude|add filler|wolf will (?:fabricate|invent)/i);
  });

  // Same contract for overflow: identify the failure mode + concrete
  // numbers + actionable edit (trim, drop sections), no vague "iterations"
  // jargon that surfaces internal algorithm details to the user.
  it('CannotFitError message tells the user the page overflowed and what to trim in resume_pool.md', async () => {
    const attempt: FitResult = {
      pdf: FAKE_PDF,
      finalParams: { fontSize: 9.5, lineHeight: 1.1, marginIn: 0.3, sectionGap: 0.85 },
      iterations: 12,
      trace: [{ iter: 12, params: { fontSize: 9.5, lineHeight: 1.1, marginIn: 0.3, sectionGap: 0.85 }, scrollHeight: 1100, pageHeightPx: 960 }],
    };
    const err = new CannotFitError(attempt);

    expect(err.message).toMatch(/too long/i);
    expect(err.message).toContain('1100px');
    expect(err.message).toContain('960px');
    // (1100 - 960) / 960 = 14.58% → rounds to 15.
    expect(err.message).toContain('15%');
    expect(err.message).toMatch(/resume_pool\.md/);
    expect(err.message).toMatch(/trim|drop/i);
  });

  // Regression guard: a long cover letter (multi-page) must not throw
  // CannotFitError either — natural layout simply paginates onto page two.
  it('renderCoverLetterPdf does not throw CannotFitError on long content', async () => {
    const fakeLongAttempt: FitResult = {
      pdf: FAKE_PDF,
      finalParams: { fontSize: 9.5, lineHeight: 1.1, marginIn: 0.3, sectionGap: 0.85 },
      iterations: 12,
      trace: [],
    };
    mockFit.mockRejectedValue(new CannotFitError(fakeLongAttempt));

    const svc = new RenderServiceImpl();
    const longHtml = '<p>'.concat('lorem ipsum '.repeat(2000), '</p>');
    await expect(svc.renderCoverLetterPdf(longHtml)).resolves.toEqual(FAKE_PDF);
    expect(mockFit).not.toHaveBeenCalled();
  });
});
