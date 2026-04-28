/** Raw job data returned by a provider — structure varies by source. */
export type RawJob = Record<string, unknown>;

/**
 * Pluggable source of job listings. Implementations wrap a single channel
 * (a JSON HTTP endpoint, an email parser, an AI-driven browser session, a
 * manual paste). `wolf hunt` fans out across every enabled provider, dedupes
 * the union, and persists the result. Extending wolf to a new job source =
 * adding one more class implementing this interface.
 */
export interface JobProvider {
  /** Display name used in logs and dedup conflict messages. */
  readonly name: string;
  /**
   * Fetches the current listings from this source. The shape is intentionally
   * loose — wolf relies on AI-driven extraction downstream to normalize.
   */
  fetch(): Promise<RawJob[]>;
}
