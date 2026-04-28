import type { HuntOptions, HuntResult } from '../utils/types/index.js';

/**
 * Use case for `wolf hunt` (Milestone 2) — fans out to enabled `JobProvider`s,
 * deduplicates the results, and persists raw jobs to SQLite with `status: new`,
 * `score: null`. Scoring is a separate command (`wolf score`).
 *
 * Currently a stub; the full pipeline lands in M2.
 */
export interface HuntApplicationService {
  /**
   * Runs every enabled provider in sequence, dedupes across providers, and
   * inserts the new rows. Returns ingested + new counts so the CLI can show
   * a one-line summary.
   */
  hunt(options: HuntOptions): Promise<HuntResult>;
}
