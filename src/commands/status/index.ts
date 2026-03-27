/**
 * status/index.ts — Job tracking dashboard.
 *
 * Reads jobs from SQLite with optional filters and returns them with a
 * status breakdown. Always polls pending AI batches before returning,
 * so scores are as up-to-date as possible.
 *
 * This command makes no AI calls itself — it only reads from the DB
 * (and triggers batch.pollAll() which may write scores back to the DB).
 */

import type { StatusOptions, StatusResult } from '../../types/index.js';

/**
 * Lists tracked jobs with their current status and score.
 *
 * @param options - All filters are optional; returns all jobs if none are set.
 *   - status: filter by one JobStatus value (e.g. 'new', 'applied')
 *   - companyIds: filter to specific companies
 *   - minScore: only return jobs with score >= this value
 *   - since: only return jobs created after this ISO 8601 date
 * @returns Matching jobs, total count, and a count breakdown by status.
 */
export async function status(_options: StatusOptions): Promise<StatusResult> {
  // TODO(M2):
  // 1. Initialize DB (initDb from utils/db)
  // 2. Poll pending batches so scores are fresh (pollAll from utils/batch)
  // 3. Query jobs applying any filters from options (getJobs)
  // 4. Count all jobs grouped by status (countByStatus)
  // 5. Return { jobs, total, byStatus }
  throw new Error('Not implemented');
}
