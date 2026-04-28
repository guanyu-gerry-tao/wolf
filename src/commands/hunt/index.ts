import type { HuntOptions, HuntResult } from '../../utils/types/index.js';

/**
 * Fetches raw job listings from all enabled providers and saves them to the database.
 *
 * Pipeline:
 * 1. Load enabled providers from config
 * 2. Run each provider in sequence, collect raw job objects
 * 3. Deduplicate across providers
 * 4. Persist raw jobs to SQLite with status: raw, score: null
 *
 * Scoring is handled separately by `score()`. This command returns immediately
 * after ingestion — no AI calls are made here.
 *
 * @param _options - Hunt options; overrides config defaults when provided.
 * @returns Ingested count and new (deduplicated) count.
 * @throws If no providers are enabled.
 */
export async function hunt(_options: HuntOptions): Promise<HuntResult> {
  // TODO(M2): const ctx = createAppContext();
  // TODO(M2): return ctx.huntApp.runPipeline(options);
  // TODO(M2): huntApp composes provider services and dedup logic,
  //           persists via jobRepository
  throw new Error('Not implemented');
}
