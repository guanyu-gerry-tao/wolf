import type { ScoreOptions, ScoreResult } from '../../types/index.js';

/**
 * Processes unscored jobs from the database: extracts structured fields via AI,
 * applies dealbreaker filters, and submits remaining jobs to Claude Batch API for scoring.
 *
 * Pipeline:
 * 1. Read jobs with score: null from SQLite
 * 2. AI field extraction — Claude extracts sponsorship, tech stack, remote, salary from JD text
 * 3. Apply dealbreakers (hard filters) — disqualified jobs saved as status: filtered
 * 4. Submit remaining jobs to Claude Batch API (async, returns batch ID immediately)
 *
 * Returns immediately after submitting the batch. Scoring results are written back
 * to the database asynchronously when the batch completes.
 *
 * @param _options - Score options; overrides config defaults when provided.
 * @returns Batch ID, number of jobs submitted for scoring, and number filtered.
 * @throws If ANTHROPIC_API_KEY is not set or no unscored jobs are found.
 */
export async function score(_options: ScoreOptions): Promise<ScoreResult> {
  // TODO(M2): const ctx = createAppContext();
  // TODO(M2): return ctx.scoreApp.runPipeline(options);
  // TODO(M2): scoreApp loads unscored jobs via jobRepository,
  //           calls scoringService (real or mock), persists back
  throw new Error('Not implemented');
}
