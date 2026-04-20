import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CannotFillError, CannotFitError, fit } from './render/fit.js';
import { log } from '../../utils/logger.js';
import type { Page } from 'playwright';
import type { RenderService } from '../renderService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHELL_PATH = path.join(__dirname, 'render', 'shell.html');

type RenderKind = 'resume' | 'cover';

export class RenderServiceImpl implements RenderService {
  async renderPdf(htmlBody: string): Promise<Buffer> {
    // Resume rendering is a one-page fit job — identical browser lifecycle
    // and PDF path as the cover letter. Delegate to the shared helper.
    return renderHtmlToPdf(htmlBody, 'resume');
  }

  async renderCoverLetterPdf(htmlBody: string): Promise<Buffer> {
    // Cover letters are also one page, and `fit()` handles both overflow
    // and underflow, so they share the exact same code path.
    return renderHtmlToPdf(htmlBody, 'cover');
  }
}

// ---------------------------------------------------------------------------
// Shared PDF rendering — launches Playwright, loads the shell, injects the
// HTML body, runs the fit loop, and cleans up the browser. Extracted so
// both public entrypoints stay at the "one obvious line" level.
// ---------------------------------------------------------------------------

async function renderHtmlToPdf(htmlBody: string, kind: RenderKind): Promise<Buffer> {
  log.debug('render.start', { kind, contentLength: htmlBody.length });
  const startedAt = Date.now();

  // Each render spawns a fresh browser — simpler state model than a pool,
  // and Playwright cold-start is only a few hundred ms.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    // Emulate print media so CSS @media print rules take effect.
    await page.emulateMedia({ media: 'print' });

    // Load the static shell (styles + layout scaffold + #resume-root placeholder).
    await page.goto('file://' + SHELL_PATH, { waitUntil: 'domcontentloaded' });

    // Inject the rendered body into the shell and wait for fonts.
    await injectHtmlIntoShell(page, htmlBody);
    await waitForFontsReady(page);

    // Run the binary-search fit loop. On failure, log the fit-specific
    // diagnostics before rethrowing so the caller only gets the one error.
    const result = await runFitWithLogging(page, kind);
    log.info('render.done', {
      kind,
      iterations: result.iterations,
      finalFontSize: result.finalParams.fontSize,
      pdfSizeBytes: result.pdf.length,
      durationMs: Date.now() - startedAt,
    });
    return result.pdf;
  } finally {
    // Always close the browser, even on fit/render errors.
    await browser.close();
  }
}

// Runs fit() and translates its typed errors into warn-level log events
// before rethrowing. Keeps renderHtmlToPdf readable by keeping the
// error-translation logic out of its main flow.
async function runFitWithLogging(page: Page, kind: RenderKind) {
  try {
    return await fit(page);
  } catch (err) {
    if (err instanceof CannotFitError) {
      log.warn('render.fit.cannot_fit', {
        kind,
        iterations: err.lastAttempt.iterations,
      });
    } else if (err instanceof CannotFillError) {
      log.warn('render.fit.cannot_fill', {
        kind,
        iterations: err.lastAttempt.iterations,
      });
    }
    throw err;
  }
}

// Place the caller-provided HTML into the shell's root container. Throws
// with a clear message if the shell template is malformed.
async function injectHtmlIntoShell(page: Page, htmlBody: string): Promise<void> {
  await page.evaluate((html: string) => {
    const root = document.getElementById('resume-root');
    if (!root) throw new Error('shell.html is missing #resume-root element');
    root.innerHTML = html;
  }, htmlBody);
}

// Wait for webfont loading before measuring page layout — otherwise the
// fit loop measures a layout with fallback fonts and picks wrong params.
async function waitForFontsReady(page: Page): Promise<void> {
  await page.evaluate(() =>
    (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready,
  );
}
