import { readFileSync } from 'node:fs';
import { callAnthropic } from './anthropicFamily.js';
import { callOpenAiCompat } from './openaiCompatFamily.js';
import { PROVIDERS, type ProviderId } from './registry.js';
import { isDevBuild } from '../../utils/instance.js';
import type { Family, FamilyCall, ProviderMeta } from './types.js';

// Family call dispatch table. TypeScript forces this map to stay in sync with
// the Family union - adding a family to the type without registering its call
// here is a compile error.
const FAMILY_CALLS: Record<Family, FamilyCall> = {
  'anthropic': callAnthropic,
  'openai-compat': callOpenAiCompat,
};

/**
 * Unified AI call. Looks up the provider in the registry, resolves env-var
 * credentials and base URL, and dispatches to the appropriate family.
 *
 * @param prompt        User message
 * @param systemPrompt  Optional system instruction
 * @param options       provider defaults to 'anthropic'; model defaults to the provider's default
 */
export async function aiClient(
  prompt: string,
  systemPrompt?: string,
  options?: { provider?: ProviderId; model?: string },
): Promise<string> {
  // Dev-only test hook: WOLF_TEST_AI_RESPONSE_FILE makes aiClient read the
  // file's contents and return them instead of hitting the network. Acceptance
  // tests use this to assert score parsing + writeback without spending money.
  // Gated on isDevBuild() so the path is impossible to enable in stable
  // user-facing builds even if someone accidentally exports the env var.
  if (isDevBuild()) {
    const stubFile = process.env.WOLF_TEST_AI_RESPONSE_FILE;
    if (stubFile) {
      return readFileSync(stubFile, 'utf-8');
    }
  }

  const providerId = options?.provider ?? 'anthropic';
  // Widen to ProviderMeta so optional fields (baseUrl, baseUrlEnv) are accessible;
  // the `as const satisfies` on PROVIDERS narrows the value type by default.
  const meta: ProviderMeta = PROVIDERS[providerId];
  const model = options?.model ?? meta.defaultModel;
  const apiKey = meta.envKey ? process.env[meta.envKey] : undefined;
  const baseURL = meta.baseUrl ?? (meta.baseUrlEnv ? process.env[meta.baseUrlEnv] : undefined);
  return FAMILY_CALLS[meta.family]({ prompt, systemPrompt, model, apiKey, baseURL });
}

export { PROVIDERS, PROVIDER_IDS, isProviderId, type ProviderId } from './registry.js';
