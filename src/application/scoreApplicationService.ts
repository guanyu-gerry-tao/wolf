import type { ScoreOptions, ScoreResult } from '../utils/types/index.js';

/**
 * Use case for `wolf score` (Milestone 2) — processes unscored jobs:
 * AI extraction of structured fields (sponsorship / tech stack / remote /
 * salary), dealbreaker filters, then submission to Claude Batch API for
 * async scoring. `--single` switches to synchronous Haiku for one job.
 *
 * Currently a stub; the full pipeline lands in M2.
 */
export interface ScoreApplicationService {
  /**
   * Scans for jobs with `score: null`, extracts fields, applies hard filters
   * (filtered → `status: filtered`), submits the rest to Batch API. Returns
   * batch id + counts for the CLI summary.
   */
  score(options: ScoreOptions): Promise<ScoreResult>;
}
