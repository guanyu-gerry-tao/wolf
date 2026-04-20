import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderServiceImpl } from '../impl/renderServiceImpl.js';
import { CannotFitError, CannotFillError } from '../impl/render/fit.js';
import { createSilentLogger } from '../../utils/logger.js';
import type { FitResult } from '../impl/render/fit.js';

const FAKE_PDF = Buffer.from('fake-pdf-bytes');

// Mock Playwright so tests don't need a real browser.
// page.pdf returns FAKE_PDF to support renderCoverLetterPdf tests.
vi.mock('playwright', () => ({
  chromium: {
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

  // renderCoverLetterPdf: reuses fit() so the PDF code path is identical to renderPdf.
  it('renderCoverLetterPdf returns pdf buffer via fit', async () => {
    mockFit.mockResolvedValue({ pdf: FAKE_PDF, finalParams: {}, iterations: 1, trace: [] } as unknown as FitResult);
    const svc = new RenderServiceImpl();
    const result = await svc.renderCoverLetterPdf('<p>Cover letter content</p>');
    expect(result).toEqual(FAKE_PDF);
    // fit IS called — cover letters are one page and share the same rendering path.
    expect(mockFit).toHaveBeenCalledOnce();
  });
});
