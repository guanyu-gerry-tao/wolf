import dotenv from 'dotenv';

dotenv.config();

/**
 * Validated environment variables loaded from `.env`.
 * Each key is `null` if not set — callers must check before use.
 *
 * @example
 * if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required');
 */
export const env = {
  /** Required for all Claude API calls (scoring, tailoring, outreach drafting). */
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? null,
  /** Required for LinkedIn and Handshake scraping via Apify. */
  APIFY_API_TOKEN: process.env.APIFY_API_TOKEN ?? null,
  /** Required for Gmail API OAuth2 (sending outreach emails). */
  GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID ?? null,
  /** Required for Gmail API OAuth2 (sending outreach emails). */
  GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET ?? null,
};
