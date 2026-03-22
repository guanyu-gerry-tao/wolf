import type { HuntOptions, HuntResult } from '../../types/index.js';

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
  // TODO(M2): load enabled providers from config
  // TODO(M2): run each provider, collect raw job objects
  // TODO(M2): deduplicate results across providers
  // TODO(M2): save to SQLite with { status: 'raw', score: null }
  throw new Error('Not implemented');
}
