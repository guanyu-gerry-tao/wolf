import type { ProviderMeta } from './types.js';

/**
 * Built-in provider registry. Source of truth for:
 *   - which providers wolf recognises (ProviderId type below)
 *   - how to connect (env var for API key, base URL, etc.)
 *   - which family handles this provider's request/response shape
 *
 * Add a new provider that fits an existing family: add one row here.
 * Add a new family: add a new FamilyCall + extend Family union in types.ts.
 */
export const PROVIDERS = {
  anthropic: {
    family: 'anthropic',
    envKey: 'WOLF_ANTHROPIC_API_KEY',
    defaultModel: 'claude-haiku-4-5-20251001',
  },
  openai: {
    family: 'openai-compat',
    envKey: 'WOLF_OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
  },
} as const satisfies Record<string, ProviderMeta>;

export type ProviderId = keyof typeof PROVIDERS;

/** Runtime-checked list of valid provider IDs, derived from the registry. */
export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function isProviderId(s: string): s is ProviderId {
  return s in PROVIDERS;
}
