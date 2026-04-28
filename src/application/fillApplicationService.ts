import type { FillOptions, FillResult } from '../utils/types/index.js';

/**
 * Use case for `wolf fill` (Milestone 4) — Playwright-driven application form
 * fill. Loads the Job + tailored resume/cover-letter paths via repositories,
 * delegates form detection + submission to `FillService`, persists status +
 * screenshot back to the job row.
 *
 * Currently a stub; the full pipeline lands in M4.
 */
export interface FillApplicationService {
  /**
   * Auto-fills the application form for `options.jobId`.
   * Defaults to dry-run; explicit `--no-dry-run` is required to submit.
   */
  fill(options: FillOptions): Promise<FillResult>;
}
