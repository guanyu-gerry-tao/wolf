/**
 * hunt/index.ts — Job ingestion command.
 *
 * Fetches raw job listings from all enabled providers and saves them to SQLite.
 * No AI calls are made here — scoring is handled separately by wolf score.
 *
 * ## Provider loading
 *
 * Providers are configured in wolf.toml and instantiated at runtime.
 * Currently planned providers:
 *   - ApiProvider: generic HTTP endpoint (see providers/ApiProvider.ts)
 *
 * To add a new provider:
 *   1. Create providers/YourProvider.ts implementing JobProvider
 *   2. Add a case in loadProviders() below
 *   3. Add config fields to wolf.toml schema in src/types/profile.ts
 *
 * ## Deduplication
 *
 * A job is considered a duplicate if a job with the same (source, url)
 * already exists in the DB. Duplicates are silently skipped by db.saveJobs().
 */

import type { HuntOptions, HuntResult, JobProvider } from '../../types/index.js';
import type { AppConfig } from '../../types/index.js';

/**
 * Fetches raw job listings from all enabled providers and saves them to SQLite.
 *
 * @param options - Hunt options; overrides config defaults when provided.
 *   - role: overrides profile.targetRoles[0]
 *   - location: overrides profile.targetLocations[0]
 *   - maxResults: overrides config.hunt.maxResults
 *   - providers: restrict to specific provider names
 *   - profileId: which profile to use (defaults to config.defaultProfileId)
 * @returns ingestedCount (total raw jobs received) and newCount (after dedup).
 * @throws If no providers are enabled in config, or if db is not initialized.
 */
export async function hunt(options: HuntOptions): Promise<HuntResult> {
  // TODO(M2):
  // 1. Load config (loadConfig) and initialize DB (initDb)
  // 2. Load enabled providers via loadProviders(config); throw if none
  //    If options.providers is set, filter to only those names
  // 3. Call provider.hunt(options) for each provider, collect all raw job objects
  // 4. Map raw objects to partial Job shape (at minimum: title, companyId, url, source, description)
  //    Use heuristics for common field names (title/job_title/name etc.)
  //    Unknown fields stay null — wolf score will fill them in later
  // 5. Save to DB via saveJobs (dedup by source+url handled inside)
  // 6. Return { ingestedCount: total raw received, newCount: actually inserted }
  throw new Error('Not implemented');
}

/**
 * Instantiates all enabled providers from config.
 * Each provider section in wolf.toml maps to one provider instance.
 *
 * @param config - Loaded AppConfig from wolf.toml
 * @returns Array of ready-to-use JobProvider instances
 */
function loadProviders(_config: AppConfig): JobProvider[] {
  // TODO(M2):
  // For each provider section in config.providers, if enabled, instantiate
  // and push into the result array. E.g. ApiProvider for config.providers.api entries.
  // Add more provider types here as they are implemented.
  return [];
}
