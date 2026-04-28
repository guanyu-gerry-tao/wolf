import type { ReachOptions, ReachResult } from '../../utils/types/index.js';
import { createAppContext, type AppContext } from '../../runtime/appContext.js';

/**
 * Finds HR contacts and drafts an outreach email for a job.
 * Stub — real implementation lands in M5.
 */
export async function reach(
  options: ReachOptions,
  ctx: AppContext = createAppContext(),
): Promise<ReachResult> {
  return ctx.reachApp.reach(options);
}
