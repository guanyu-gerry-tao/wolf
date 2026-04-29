/**
 * Thrown when an AI-backed flow needs an API key the user hasn't set.
 *
 * Carries enough structured context that both the CLI top-level catch and
 * MCP tool handlers can render a clear next step — the env var to set, the
 * command that sets it, and the URL where the user gets the key.
 */
export class MissingApiKeyError extends Error {
  readonly code = 'MISSING_API_KEY' as const;

  constructor(
    /** Full env var name expected, e.g. `WOLF_ANTHROPIC_API_KEY`. */
    readonly keyName: string,
    /** Where the user can obtain this key. */
    readonly hintUrl: string,
    /** Shell command the user runs to set the key. */
    readonly setCommand: string = 'wolf env set',
  ) {
    super(
      `${keyName} is not set. Run '${setCommand}' or get a key at ${hintUrl}`,
    );
    this.name = 'MissingApiKeyError';
  }
}
