import type { FillOptions, FillResult } from '../../types/index.js';

/**
 * Auto-fills a job application form using Playwright.
 *
 * Pipeline:
 * 1. Fetch job URL from SQLite
 * 2. Launch Playwright browser (headless by default)
 * 3. Detect form fields on the page
 * 4. Map fields to profile data (name, email, resume file, etc.)
 * 5. If `dryRun` is false, fill and submit the form
 * 6. Take a screenshot for the audit trail
 * 7. Update job status to "applied" in SQLite
 *
 * @param _options - Must include `jobId`. Defaults to dry-run mode.
 * @returns Detected fields, submitted flag, and screenshot path.
 * @throws If the job URL is missing or Playwright cannot load the page.
 */
export async function fill(_options: FillOptions): Promise<FillResult> {
  // TODO: fetch job URL from SQLite
  // TODO: launch Playwright browser
  // TODO: detect form fields on the page
  // TODO: map fields to profile data
  // TODO: if not dryRun, fill and submit the form
  // TODO: take screenshot for audit trail
  // TODO: update job status in SQLite
  throw new Error('Not implemented');
}
