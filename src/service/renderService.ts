import type { CannotFitError, CannotFillError } from './impl/render/fit.js';

export interface RenderService {
  /**
   * Render HTML body content to a one-page PDF via Playwright + fit algorithm.
   * Works for any HTML body injected into shell.html's #resume-root —
   * resumes use this method to ensure content fills exactly one page.
   * @param htmlBody - HTML to inject into shell.html's #resume-root
   * @returns PDF as a Buffer
   * @throws {CannotFitError} if content is too long to fit on one page
   * @throws {CannotFillError} if content is too short to fill the page
   */
  renderPdf(htmlBody: string): Promise<Buffer>;

  /**
   * Render HTML body content to PDF at natural CSS-driven layout, without
   * the fit algorithm. Used for cover letters: short letters keep their
   * bottom whitespace; long letters paginate naturally to a second page.
   * Never throws CannotFitError or CannotFillError.
   * @param htmlBody - HTML to inject into shell.html's #resume-root
   * @returns PDF as a Buffer
   */
  renderCoverLetterPdf(htmlBody: string): Promise<Buffer>;
}

export type { CannotFitError, CannotFillError };
