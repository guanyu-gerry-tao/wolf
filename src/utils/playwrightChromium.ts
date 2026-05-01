import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { MissingChromiumError } from './errors/missingChromiumError.js';

let chromiumChecked = false;

export async function ensurePlaywrightChromiumInstalled(): Promise<void> {
  if (chromiumChecked) return;
  const exe = chromium.executablePath();
  if (exe && fs.existsSync(exe)) {
    chromiumChecked = true;
    return;
  }

  // First-time setup: stream the official installer so users see progress.
  process.stderr.write(
    'wolf: first-time setup — downloading Playwright Chromium (~150 MB, one-time). This may take a minute...\n',
  );
  await runPlaywrightInstall();

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
