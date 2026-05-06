import type { ScoreOptions, ScoreResult } from '../utils/types/index.js';

/**
 * Use case for `wolf score` — produces tier-based job triage against the
 * active profile.
 *
 * Default mode submits unscored jobs to the async AI Batch API. `--poll`
 * applies completed batch items back to Job rows. `--single` runs one
 * synchronous score and writes the verdict immediately.
 *
 * AI scoring writes `Job.tierAi` plus `Job.scoreJustification`; manual user
 * overrides live on `Job.tierUser` and are not changed by this use case.
 */
export interface ScoreApplicationService {
  /**
   * Runs score in one of its supported modes and returns counts or the
   * synchronous markdown verdict for CLI formatting.
   */
  score(options: ScoreOptions): Promise<ScoreResult>;
}
