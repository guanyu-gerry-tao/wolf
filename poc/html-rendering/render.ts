// poc/html-rendering/render.ts
// Standalone POC driver. NOT part of production code under src/.
// Run with: npx tsx poc/html-rendering/render.ts
//
// Loads shell.html, injects each fixture body in turn, runs fit() to
// converge on one page, and prints the iteration trace. Each run produces
// one PDF under output/ (or output/resume-<name>-failed.pdf on CannotFitError).

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { fit, CannotFitError, CannotFillError, type FitResult } from './fit.js';

/**
 * Render a PDF to PNG pages using `pdftoppm` (poppler-utils).
 * - Single-page PDFs → `<prefix>.png` (no suffix, via `-singlefile`)
 * - Multi-page PDFs  → `<prefix>-1.png`, `<prefix>-2.png`, ...
 *
 * Graceful degradation: if pdftoppm isn't on PATH, skips PNG generation
 * and prints a one-shot warning. PDFs still get written normally — PNG
 * is purely a reviewer convenience.
 */
const HAS_PDFTOPPM =
  spawnSync('which', ['pdftoppm'], { encoding: 'utf-8' }).status === 0;

if (!HAS_PDFTOPPM) {
  console.warn(
    `⚠️  pdftoppm not found on PATH — skipping PNG rendering.\n` +
      `    Install with one of:\n` +
      `      macOS:            brew install poppler\n` +
      `      Debian / Ubuntu:  sudo apt install poppler-utils\n` +
      `      Fedora / Arch:    sudo dnf install poppler-utils / pacman -S poppler\n` +
      `      Windows:          choco install poppler  (or scoop install poppler)\n` +
      `    PDFs will still be generated normally.\n`,
  );
}

function pdfToPng(pdfPath: string, pageCount: number): void {
  if (!HAS_PDFTOPPM) return;
  const prefix = pdfPath.replace(/\.pdf$/, '');
  const args = ['-png', '-r', '150'];
  if (pageCount === 1) args.push('-singlefile');
  args.push(pdfPath, prefix);
  const r = spawnSync('pdftoppm', args, { encoding: 'utf-8' });
  if (r.status !== 0) {
    throw new Error(
      `pdftoppm failed on ${pdfPath}: ${r.stderr || 'unknown error'}`,
    );
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHELL_PATH = path.join(__dirname, 'shell.html');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const OUTPUT_DIR = path.join(__dirname, 'output', 'fit');

// Density levels spanning sparse → dense. 40/50 should throw CannotFillError
// (too sparse even for max section-gap expansion), 60 should expand to fill,
// 70–110 exercise the shrink path with varying squeeze, 120 stretches all
// three shrink axes, 130 throws CannotFitError (too dense even at floors).
const FIXTURES = ['40', '50', '60', '70', '80', '90', '100', '110', '120', '130'] as const;

function formatTrace(trace: FitResult['trace']): string {
  return trace
    .map(
      (t) =>
        `  iter ${t.iter}: fs=${t.params.fontSize}pt lh=${t.params.lineHeight} m=${t.params.marginIn}in gap=${t.params.sectionGap}em → scrollHeight=${t.scrollHeight}px (target ≤ ${Math.round(t.pageHeightPx)}px)`,
    )
    .join('\n');
}

async function runFixture(name: (typeof FIXTURES)[number]): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Emulate print media so any @media print rules fire during layout.
  await page.emulateMedia({ media: 'print' });
  // domcontentloaded — don't block on Google Fonts CDN. If Inter fails
  // to load, Helvetica Neue / sans-serif fallback is still acceptable
  // for the spike's visual inspection.
  await page.goto('file://' + SHELL_PATH, { waitUntil: 'domcontentloaded' });

  const body = await fs.readFile(path.join(FIXTURES_DIR, `body-${name}.html`), 'utf8');
  await page.evaluate((html: string) => {
    const root = document.getElementById('resume-root');
    if (!root) throw new Error('shell is missing #resume-root');
    root.innerHTML = html;
  }, body);

  // wait for fonts (Google Fonts Inter) to load before measuring
  await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready);

  try {
    const result = await fit(page);
    const pdfPath = path.join(OUTPUT_DIR, `resume-${name}.pdf`);
    await fs.writeFile(pdfPath, result.pdf);

    const doc = await PDFDocument.load(result.pdf);
    const pageCount = doc.getPageCount();
    pdfToPng(pdfPath, pageCount);

    console.log(`\n[${name}] ✓ fit in ${result.iterations} iter(s)`);
    console.log(`  final params: ${JSON.stringify(result.finalParams)}`);
    console.log(`  pdf pages: ${pageCount}`);
    console.log(`  wrote: ${pdfPath}  (+ rendered .png via pdftoppm)`);
    console.log(formatTrace(result.trace));
  } catch (err) {
    if (err instanceof CannotFitError || err instanceof CannotFillError) {
      const kind = err instanceof CannotFitError ? 'fit' : 'fill';
      const pdfPath = path.join(OUTPUT_DIR, `resume-${name}-failed-${kind}.pdf`);
      await fs.writeFile(pdfPath, err.lastAttempt.pdf);

      let pageCount = -1;
      try {
        const doc = await PDFDocument.load(err.lastAttempt.pdf);
        pageCount = doc.getPageCount();
      } catch {
        // ignore — PDF may be malformed, just report -1
      }
      if (pageCount > 0) pdfToPng(pdfPath, pageCount);

      console.log(
        `\n[${name}] ✗ ${err.constructor.name} after ${err.lastAttempt.iterations} iter(s)`,
      );
      console.log(`  last params: ${JSON.stringify(err.lastAttempt.finalParams)}`);
      console.log(`  last pdf pages: ${pageCount}`);
      console.log(`  wrote (for inspection): ${pdfPath}  (+ rendered .png via pdftoppm)`);
      console.log(formatTrace(err.lastAttempt.trace));
    } else {
      throw err;
    }
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  // Fresh output dir every run — prevents stale PDFs from lingering when a
  // fixture changes status (e.g. was success, now fails).
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  for (const fixture of FIXTURES) {
    await runFixture(fixture);
  }
  console.log('\nDone. Open the PDFs under poc/html-rendering/output/ to eyeball.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
