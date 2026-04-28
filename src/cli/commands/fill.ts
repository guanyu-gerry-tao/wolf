import type { FillOptions, FillResult } from '../../utils/types/index.js';
import { createAppContext, type AppContext } from '../../runtime/appContext.js';

/**
 * Auto-fills a job application form using Playwright.
 * Stub — real implementation lands in M4.
 */
export async function fill(
  options: FillOptions,
  ctx: AppContext = createAppContext(),
): Promise<FillResult> {
  return ctx.fillApp.fill(options);
}
