import type { CannotFitError, CannotFillError } from './impl/render/fit.js';

export interface RenderService {
  /**
   * Render HTML body content to a one-page PDF.
   * @param htmlBody - HTML to inject into shell.html's #resume-root
   * @returns PDF as a Buffer
   * @throws {CannotFitError} if content is too long to fit on one page even at minimum font/margin
   * @throws {CannotFillError} if content is too short to fill the page
   */
  renderResumePdf(htmlBody: string): Promise<Buffer>;
}

export type { CannotFitError, CannotFillError };
