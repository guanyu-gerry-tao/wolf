import type { JobListOptions, JobListResult } from '../utils/types/commands.js';

/**
 * Use case for `wolf job list` — the filtered job listing. Validates raw
 * CLI input at the application boundary (rejects bad `--status`, NaN
 * `--min-score`, unparseable `--start` / `--end`, non-positive `--limit`),
 * runs the filter as a single SQL query, and resolves company names for
 * display with a per-call cache.
 */
export interface JobApplicationService {
  /**
   * Returns matching jobs (with display-resolved company names) plus the
   * unlimited `totalMatching` count. The CLI uses `totalMatching` to render
   * the overflow footer (`... N more — use --limit`).
   */
  list(options: JobListOptions): Promise<JobListResult>;
}
