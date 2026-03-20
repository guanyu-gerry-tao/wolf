import type { StatusOptions, StatusResult } from '../../types/index.js';

/**
 * Lists tracked jobs with their current status and score.
 *
 * Reads directly from SQLite — no external API calls.
 * Supports filtering by status, minimum score, date, and company.
 *
 * @param _options - All filters are optional; returns all jobs if none are set.
 * @returns Matching jobs, total count, and a breakdown by status.
 */
export async function status(_options: StatusOptions): Promise<StatusResult> {
  // TODO: query jobs from SQLite with filters (status, score, date, company)
  // TODO: aggregate counts by status
  throw new Error('Not implemented');
}
