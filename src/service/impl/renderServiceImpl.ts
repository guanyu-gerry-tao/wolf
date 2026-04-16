import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fit } from './render/fit.js';
import type { RenderService } from '../renderService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHELL_PATH = path.join(__dirname, 'render', 'shell.html');

export class RenderServiceImpl implements RenderService {
  async renderPdf(htmlBody: string): Promise<Buffer> {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
      await page.emulateMedia({ media: 'print' });
      await page.goto('file://' + SHELL_PATH, { waitUntil: 'domcontentloaded' });
      // Inject the HTML body into the shell's #resume-root container.
      await page.evaluate((html: string) => {
        const root = document.getElementById('resume-root');
        if (!root) throw new Error('shell.html is missing #resume-root element');
        root.innerHTML = html;
      }, htmlBody);
      // Wait for fonts to finish loading before measuring layout.
      await page.evaluate(() =>
        (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready
      );
      const result = await fit(page);
      return result.pdf;
    } finally {
      await browser.close();
    }
  }

  async renderCoverLetterPdf(htmlBody: string): Promise<Buffer> {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
      await page.emulateMedia({ media: 'print' });
      await page.goto('file://' + SHELL_PATH, { waitUntil: 'domcontentloaded' });
      // Inject the HTML body into the shell's #resume-root container.
      await page.evaluate((html: string) => {
        const root = document.getElementById('resume-root');
        if (!root) throw new Error('shell.html is missing #resume-root element');
        root.innerHTML = html;
      }, htmlBody);
      // Wait for fonts to finish loading before measuring layout.
      await page.evaluate(() =>
        (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready
      );
      // Reuse fit() — cover letters are one page and fit handles both overflow
      // and underflow. This shares the exact same PDF code path as renderPdf().
      const result = await fit(page);
      return result.pdf;
    } finally {
      await browser.close();
    }
  }
}
