import { isProviderId, PROVIDER_IDS } from './ai/registry.js';
import type { AiConfig } from '../types/index.js';

/**
 * Parses a "<provider>/<model>" reference into the AiConfig shape services expect.
 * Splits on the FIRST "/" so model names containing slashes
 * (e.g. HuggingFace-style "meta-llama/Llama-3") survive the round-trip.
 * Throws on unknown provider or malformed input.
 */
export function parseModelRef(ref: string): AiConfig {
  const slash = ref.indexOf('/');
  if (slash <= 0 || slash === ref.length - 1) {
    throw new Error(`Invalid model ref "${ref}": expected "<provider>/<model>"`);
  }
  const provider = ref.slice(0, slash);
  const model = ref.slice(slash + 1);
  if (!isProviderId(provider)) {
    throw new Error(`Unknown provider "${provider}" in model ref "${ref}": expected one of ${PROVIDER_IDS.join(', ')}`);
  }
  return { provider, model };
}
