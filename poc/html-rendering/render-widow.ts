// poc/html-rendering/render-widow.ts
// Standalone POC driver for TEST 1 — widow / short-last-line handling.
// Run with: npx tsx poc/html-rendering/render-widow.ts
//
// Loads shell.html, injects the bullets-spectrum fixture (40 bullets across
// 4 length buckets), and renders ONCE at default parameters — NO fit() call.
// The resulting multi-page PDF is for visual inspection of how CSS
// text-wrap: pretty handles widows at varied bullet lengths.

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const HAS_PDFTOPPM =
  spawnSync('which', ['pdftoppm'], { encoding: 'utf-8' }).status === 0;

if (!HAS_PDFTOPPM) {
  console.warn(
    `⚠️  pdftoppm not found on PATH — skipping PNG rendering (PDF still written).`,
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
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'body-bullets-spectrum.html');
const OUTPUT_DIR = path.join(__dirname, 'output', 'widow');

// Default params — match shell.html :root defaults.
const DEFAULT_MARGIN_IN = 0.5;
const LETTER_WIDTH_IN = 8.5;
const LETTER_HEIGHT_IN = 11;
const DPI = 96;

async function main(): Promise<void> {
  // Fresh output dir every run.
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print' });

  // Set viewport to the default printable area so layout matches PDF.
  const width = Math.round((LETTER_WIDTH_IN - 2 * DEFAULT_MARGIN_IN) * DPI);
  const height = Math.round((LETTER_HEIGHT_IN - 2 * DEFAULT_MARGIN_IN) * DPI);
  await page.setViewportSize({ width, height });

  await page.goto('file://' + SHELL_PATH, { waitUntil: 'domcontentloaded' });

  const body = await fs.readFile(FIXTURE_PATH, 'utf8');
  await page.evaluate((html: string) => {
    const root = document.getElementById('resume-root');
    if (!root) throw new Error('shell is missing #resume-root');
    root.innerHTML = html;
  }, body);

  // No fit() — we want the natural default-parameter layout so that
  // text-wrap: pretty's widow handling is exercised without interference
  // from any size-driven CSS variable overrides.
  const pdf = await page.pdf({
    printBackground: true,
    preferCSSPageSize: true,
  });

  const outputPath = path.join(OUTPUT_DIR, 'spectrum.pdf');
  await fs.writeFile(outputPath, pdf);

  const doc = await PDFDocument.load(pdf);
  const pageCount = doc.getPageCount();
  pdfToPng(outputPath, pageCount);

  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const targetPerPage = Math.round((LETTER_HEIGHT_IN - 2 * DEFAULT_MARGIN_IN) * DPI);

  console.log(`[widow-spectrum] rendered without fit()`);
  console.log(`  fixture:       ${path.relative(process.cwd(), FIXTURE_PATH)}`);
  console.log(`  wrote pdf:     ${path.relative(process.cwd(), outputPath)}  (+ per-page .png via pdftoppm)`);
  console.log(`  pdf pages:     ${pageCount}`);
  console.log(`  scrollHeight:  ${scrollHeight}px (target per page ≤ ${targetPerPage}px)`);
  console.log(`  → open and eyeball each of the 4 sections for widow behavior:`);
  console.log(`      - Very short bullets (~5 words)`);
  console.log(`      - Medium bullets (~12 words)`);
  console.log(`      - Long bullets (~25 words)`);
  console.log(`      - Very long bullets (~40 words)`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
