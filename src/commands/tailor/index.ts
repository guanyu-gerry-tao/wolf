import type { TailorOptions, TailorResult } from '../../types/index.js';
import { createAppContext, type AppContext } from '../../cli/appContext.js';

/**
 * Tailors a resume for a specific job using the full pipeline:
 * RewriteService → RenderService → one-page PDF.
 *
 * @param options - Must include `jobId`; profileId defaults to defaultProfileId.
 * @param ctx - AppContext for dependency injection; defaults to real SQLite-backed context.
 * @returns Paths to generated PDF and match score.
 * @throws If the job does not exist, AI fails, or render fails.
 */
export async function tailor(
  options: TailorOptions,
  ctx: AppContext = createAppContext(),
): Promise<TailorResult> {
  return ctx.tailorApp.tailor(options.jobId, options.profileId);
}
