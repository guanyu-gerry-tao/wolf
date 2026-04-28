import type { ScoreOptions, ScoreResult } from '../../utils/types/index.js';
import { createAppContext, type AppContext } from '../../runtime/appContext.js';

/**
 * AI extraction + dealbreaker filters + Batch API submission.
 * Stub — real implementation lands in M2.
 */
export async function score(
  options: ScoreOptions,
  ctx: AppContext = createAppContext(),
): Promise<ScoreResult> {
  return ctx.scoreApp.score(options);
}
