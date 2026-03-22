/**
 * API keys for wolf, read from system environment variables.
 *
 * Keys must be set in your shell config (e.g. ~/.zshrc) or system environment,
 * NOT in a .env file inside the workspace — workspace directories may be shared,
 * synced to cloud storage, or zipped up alongside resume files.
 *
 * Setup:
 *   echo 'export WOLF_ANTHROPIC_API_KEY=sk-...' >> ~/.zshrc && source ~/.zshrc
 *
 * Each key is `null` if not set — callers must check before use.
 *
 * @example
 * if (!env.ANTHROPIC_API_KEY) throw new Error('WOLF_ANTHROPIC_API_KEY is not set');
 */
export const env = {
  /** Required for all Claude API calls (scoring, tailoring, outreach drafting). */
  ANTHROPIC_API_KEY: process.env.WOLF_ANTHROPIC_API_KEY ?? null,
  /** Required for job provider integrations that use external APIs. */
  APIFY_API_TOKEN: process.env.WOLF_APIFY_API_TOKEN ?? null,
  /** Required for Gmail API OAuth2 (sending outreach emails). */
  GMAIL_CLIENT_ID: process.env.WOLF_GMAIL_CLIENT_ID ?? null,
  /** Required for Gmail API OAuth2 (sending outreach emails). */
  GMAIL_CLIENT_SECRET: process.env.WOLF_GMAIL_CLIENT_SECRET ?? null,
};
