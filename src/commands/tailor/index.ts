import type { TailorOptions, TailorResult } from '../../types/index.js';
import type { AnalyzeResult, WriteStepResult } from '../../application/tailorApplicationService.js';
import { createAppContext, type AppContext } from '../../cli/appContext.js';

/**
 * Full tailor pipeline: analyst brief -> (resume + cover letter in parallel).
 */
export async function tailor(
  options: TailorOptions,
  ctx: AppContext = createAppContext(),
): Promise<TailorResult> {
  return ctx.tailorApp.tailor(options);
}

/** Analyst step only: produce data/<jobId>/src/tailoring-brief.md. */
export async function tailorBrief(
  options: TailorOptions,
  ctx: AppContext = createAppContext(),
): Promise<AnalyzeResult> {
  return ctx.tailorApp.analyze(options);
}

/** Resume writer only (requires an existing brief). */
export async function tailorResume(
  options: TailorOptions,
  ctx: AppContext = createAppContext(),
): Promise<WriteStepResult> {
  return ctx.tailorApp.writeResume(options);
}

/** Cover letter writer only (requires an existing brief). */
export async function tailorCoverLetter(
  options: TailorOptions,
  ctx: AppContext = createAppContext(),
): Promise<WriteStepResult> {
  return ctx.tailorApp.writeCoverLetter(options);
}
