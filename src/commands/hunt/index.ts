import type { HuntOptions, HuntResult } from '../../utils/types/index.js';
import { createAppContext, type AppContext } from '../../runtime/appContext.js';

/**
 * Fetches raw job listings from all enabled providers and saves them.
 * Stub — real implementation lands in M2.
 */
export async function hunt(
  options: HuntOptions,
  ctx: AppContext = createAppContext(),
): Promise<HuntResult> {
  return ctx.huntApp.hunt(options);
}
