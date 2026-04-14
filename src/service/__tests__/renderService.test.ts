import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderServiceImpl } from '../impl/renderServiceImpl.js';
import { CannotFitError, CannotFillError } from '../impl/render/fit.js';
import type { FitResult } from '../impl/render/fit.js';

// Mock Playwright so tests don't need a real browser.
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        emulateMedia: vi.fn().mockResolvedValue(undefined),
        goto: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(undefined),
        pdf: vi.fn(),
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

const FAKE_PDF = Buffer.from('fake-pdf-bytes');

describe('RenderServiceImpl', () => {
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
    const result = await svc.renderResumePdf('<h2>Experience</h2>');
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
    await expect(svc.renderResumePdf('<h2>Too much content</h2>')).rejects.toThrow(CannotFitError);
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
    await expect(svc.renderResumePdf('<h2>Too little</h2>')).rejects.toThrow(CannotFillError);
  });
});
