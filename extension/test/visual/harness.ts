// State-matrix screenshot harness. Boots the mock daemon + a static
// server for the built dist/, then renders each scenario × viewport in
// a real (headless) Chromium and saves a PNG. Outputs a report.md
// summarizing the matrix.

import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startMockServer } from './mockServer.ts';
import { VISUAL_STATES } from './states.ts';
import { VIEWPORTS } from './viewports.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT_ROOT = path.resolve(HERE, '..', '..');
const DIST_DIR = path.join(EXT_ROOT, 'dist');
const SNAPSHOT_DIR = path.join(HERE, 'snapshots', 'current');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function startStaticServer(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURI((req.url || '/').split('?')[0]);
      const safe = path.normalize(path.join(DIST_DIR, urlPath));
      if (!safe.startsWith(DIST_DIR)) { res.statusCode = 403; res.end(); return; }
      const target = (await stat(safe)).isDirectory() ? path.join(safe, 'index.html') : safe;
      const buf = await readFile(target);
      res.setHeader('Content-Type', MIME[path.extname(target)] ?? 'application/octet-stream');
      res.end(buf);
    } catch {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  return {
    port,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function main() {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const mock = await startMockServer('disconnected');
  const staticServer = await startStaticServer();
  const browser = await chromium.launch({ headless: true });

  const reportLines: string[] = [
    '# Companion visual review',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Mock daemon port: ${mock.port}`,
    '',
    '| State | Viewport | Path |',
    '|---|---|---|',
  ];

  let captured = 0;
  let failed = 0;

  for (const stateDef of VISUAL_STATES) {
    mock.setPreset(stateDef.preset);
    for (const viewport of VIEWPORTS) {
      const screenshotPath = path.join(SNAPSHOT_DIR, `${stateDef.id}--${viewport.id}.png`);
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      try {
        // Seed localStorage before navigation so the first-run flag is
        // honored by the very first paint.
        await page.addInitScript(`(() => {
          try {
            localStorage.setItem('wolf.firstRunSeen', ${JSON.stringify(stateDef.firstRunSeen ? 'true' : 'false')});
            localStorage.setItem('wolfServePort', ${JSON.stringify(String(mock.port))});
          } catch {}
        })();`);
        await page.goto(`http://127.0.0.1:${staticServer.port}/src/sidepanel/index.html`, { waitUntil: 'networkidle' });
        if (stateDef.setup) {
          await page.evaluate(`(async () => {
            ${stateDef.setup}
          })();`);
        }
        // Brief settle so post-setup state has rendered.
        await page.waitForTimeout(150);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        captured += 1;
        const relPath = path.relative(EXT_ROOT, screenshotPath);
        reportLines.push(`| ${stateDef.id} | ${viewport.id} (${viewport.width}×${viewport.height}) | ${relPath} |`);
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        reportLines.push(`| ${stateDef.id} | ${viewport.id} | error: ${message} |`);
      } finally {
        if (errors.length > 0) {
          reportLines.push(`> errors for ${stateDef.id} ${viewport.id}: ${errors.slice(0, 3).join(' / ')}`);
        }
        await context.close();
      }
    }
  }

  await browser.close();
  await mock.close();
  await staticServer.close();

  reportLines.push('', `**Summary:** ${captured} screenshots captured, ${failed} failed.`);
  const reportPath = path.join(HERE, 'report.md');
  await writeFile(reportPath, reportLines.join('\n'));
  console.log(`[harness] ${captured} screenshots → ${SNAPSHOT_DIR}`);
  console.log(`[harness] report → ${reportPath}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
