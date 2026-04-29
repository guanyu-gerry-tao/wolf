/**
 * Thrown when Playwright's bundled Chromium binary cannot be located AND
 * the on-demand `npx playwright install chromium` fallback also failed.
 *
 * Render service calls the auto-installer first; this error is the last
 * resort. The message tells the user the manual command to run plus
 * common failure reasons (disk full, network blocked).
 */
export class MissingChromiumError extends Error {
  readonly code = 'MISSING_CHROMIUM' as const;
  readonly installCommand = 'npx playwright install chromium' as const;

  constructor(cause?: unknown) {
    super(
      `Playwright Chromium is not installed and the auto-install attempt failed. ` +
        `Run '${'npx playwright install chromium'}' manually to install it (~150 MB to ~/.cache/ms-playwright/). ` +
        `Common causes: disk full, network blocked, or no write permission to the cache directory.`,
    );
    this.name = 'MissingChromiumError';
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
