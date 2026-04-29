import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CannotFillError, CannotFitError, fit } from './render/fit.js';
import { log } from '../../utils/logger.js';
import { MissingChromiumError } from '../../utils/errors/missingChromiumError.js';
import type { Browser, Page } from 'playwright';
import type { RenderService } from '../renderService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHELL_PATH = path.join(__dirname, 'render', 'shell.html');

// First-launch hook. Stable users only get the `playwright` npm package via
// `npm i -g`; the Chromium binary itself is downloaded on demand by Playwright
// the first time `chromium.launch()` is called. Detecting the missing binary
// up front lets us print a clean status message + spawn the official installer
// with its progress bar visible, instead of letting Playwright's internal
// stack trace surface.
let chromiumChecked = false;
async function ensureChromium(): Promise<void> {
  if (chromiumChecked) return;
  const exe = chromium.executablePath();
  if (exe && fs.existsSync(exe)) {
    chromiumChecked = true;
    return;
  }
  // First-time setup: stream the installer's stderr/stdout so the user sees
  // the download progress bar instead of a silent hang.
  process.stderr.write(
    'wolf: first-time setup — downloading Playwright Chromium (~150 MB, one-time). This may take a minute...\n',
  );
  await runPlaywrightInstall();
  // After the installer completes, the executable should exist. If it still
  // doesn't, we surface a typed error rather than letting `launch()` fail.
  const exeAfter = chromium.executablePath();
  if (!exeAfter || !fs.existsSync(exeAfter)) {
    throw new MissingChromiumError();
  }
  chromiumChecked = true;
}

function runPlaywrightInstall(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['playwright', 'install', 'chromium'], {
      stdio: 'inherit',
    });
    child.on('error', (err) => reject(new MissingChromiumError(err)));
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new MissingChromiumError(new Error(`installer exited with code ${code}`)));
    });
  });
}

/**
 * Playwright-backed `RenderService`. Routes to two distinct pipelines —
 * `fit()`-driven resume rendering with binary-search CSS sizing, and
 * natural-layout cover-letter rendering. Both inject the body into
 * `shell.html`'s `#resume-root` so styling is centralized.
 */
export class RenderServiceImpl implements RenderService {
  /** @inheritdoc */
  async renderPdf(htmlBody: string): Promise<Buffer> {
    // Resume rendering is a one-page fit job: shrink-to-fit when content
    // overflows, expand-to-fill when it underflows, throwing CannotFitError
    // / CannotFillError if neither path converges.
    return renderResumePdfFit(htmlBody);
  }

  /** @inheritdoc */
  async renderCoverLetterPdf(htmlBody: string): Promise<Buffer> {
    // Cover letters render at natural CSS-driven layout. No fit loop —
    // short content keeps its bottom whitespace, long content paginates
    // naturally to a second page. See DECISIONS.md 2026-04-25 for why we
    // dropped the single-page fit on cover letters.
    return renderHtmlToPdfNatural(htmlBody);
  }
}

// ---------------------------------------------------------------------------
// Resume render — single-page fit. Launches Playwright, loads the shell,
// injects the HTML body, runs the fit loop, and cleans up the browser.
// ---------------------------------------------------------------------------

async function renderResumePdfFit(htmlBody: string): Promise<Buffer> {
  const kind = 'resume';
  log.debug('render.start', { kind, contentLength: htmlBody.length, mode: 'fit' });
  const startedAt = Date.now();

  // Each render spawns a fresh browser — simpler state model than a pool,
  // and Playwright cold-start is only a few hundred ms.
  await ensureChromium();
  const browser = await chromium.launch();
  try {
    const page = await loadShellPage(browser, htmlBody);

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

// ---------------------------------------------------------------------------
// Cover letter render — natural layout, no fit. Renders the shell at default
// page size and lets Chromium paginate naturally. Multi-page output is OK;
// a short letter keeping its bottom whitespace is OK. The shell's @page rule
// + page-break-inside guards on h1/h2/h3 keep multi-page output readable.
// ---------------------------------------------------------------------------

async function renderHtmlToPdfNatural(htmlBody: string): Promise<Buffer> {
  const kind = 'cover';
  log.debug('render.start', { kind, contentLength: htmlBody.length, mode: 'natural' });
  const startedAt = Date.now();

  await ensureChromium();
  const browser = await chromium.launch();
  try {
    const page = await loadShellPage(browser, htmlBody);

    // preferCSSPageSize: true makes Playwright honor the shell's @page rule
    // (Letter, 0.5in margin) — the same geometry as the resume's page size,
    // just without the fit loop's CSS-variable overrides.
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
    log.info('render.done', {
      kind,
      mode: 'natural',
      pdfSizeBytes: pdf.length,
      durationMs: Date.now() - startedAt,
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

// Open a fresh page, emulate print media, load the shell, inject body,
// and wait for webfonts. Shared by both resume (fit) and cover (natural)
// paths so the prelude stays in one place.
async function loadShellPage(browser: Browser, htmlBody: string): Promise<Page> {
  const page = await browser.newPage();
  // Emulate print media so CSS @media print rules take effect.
  await page.emulateMedia({ media: 'print' });
  // Load the static shell (styles + layout scaffold + #resume-root placeholder).
  await page.goto('file://' + SHELL_PATH, { waitUntil: 'domcontentloaded' });
  // Inject the rendered body into the shell and wait for fonts.
  await injectHtmlIntoShell(page, htmlBody);
  await waitForFontsReady(page);
  return page;
}

// Runs fit() and translates its typed errors into warn-level log events
// before rethrowing. Keeps the resume render path readable by keeping the
// error-translation logic out of its main flow.
async function runFitWithLogging(page: Page, kind: 'resume') {
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
