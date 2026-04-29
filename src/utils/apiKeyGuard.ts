import { getEnvValue, currentBinaryName } from './instance.js';
import { MissingApiKeyError } from './errors/missingApiKeyError.js';

/**
 * Pluggable hint table — each known key maps to its provisioning URL.
 * Adding a key here is the only change required to wire a new provider
 * (APIFY, GMAIL_CLIENT_ID, ...) into the guard system.
 */
const KEY_HINTS: Readonly<Record<string, string>> = {
  ANTHROPIC_API_KEY: 'https://console.anthropic.com/',
  APIFY_API_TOKEN: 'https://console.apify.com/account/integrations',
  GMAIL_CLIENT_ID: 'https://console.cloud.google.com/apis/credentials',
  GMAIL_CLIENT_SECRET: 'https://console.cloud.google.com/apis/credentials',
};

/**
 * Throws `MissingApiKeyError` if the named API key isn't set in the
 * environment. Honors the dev-build prefix override (WOLF_DEV_*) via
 * `getEnvValue`.
 *
 * Pass the bare name (`ANTHROPIC_API_KEY`); the helper composes the full
 * `WOLF_<NAME>` for the user-facing error message.
 */
export function assertApiKey(name: keyof typeof KEY_HINTS | string): void {
  const value = getEnvValue(name);
  if (value && value.length > 0) return;

  const hintUrl = KEY_HINTS[name] ?? '';
  // setCommand reflects the binary the user actually ran (`wolf` for stable,
  // `wolf-dev` for dev) so the error banner suggests a command they can copy.
  throw new MissingApiKeyError(`WOLF_${name}`, hintUrl, `${currentBinaryName()} env set`);
}
