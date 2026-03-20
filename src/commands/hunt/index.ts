import type { HuntOptions, HuntResult } from '../../types/index.js';

/**
 * Finds and scores job listings from all enabled providers.
 *
 * Pipeline:
 * 1. Load enabled providers from config
 * 2. Run each provider in sequence, collect all jobs
 * 3. Deduplicate across providers
 * 4. Apply dealbreakers (hard filters) — disqualified jobs are saved as "filtered"
 * 5. Score remaining jobs (hybrid: algorithm + Claude API for roleMatch)
 * 6. Persist all results to SQLite
 *
 * @param _options - Hunt options; overrides config defaults when provided.
 * @returns Scored job listings, new count, and average score.
 * @throws If no providers are enabled or a required API key is missing.
 */
export async function hunt(_options: HuntOptions): Promise<HuntResult> {
  // TODO: load enabled providers from config
  // TODO: run each provider, collect jobs
  // TODO: deduplicate results
  // TODO: apply dealbreakers
  // TODO: score with hybrid model (algorithm + Claude API for roleMatch)
  // TODO: save to SQLite
  throw new Error('Not implemented');
}
