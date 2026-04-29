/**
 * Thrown when wolf tries to read a workspace (`wolf.toml` etc.) but the
 * workspace directory has never been initialized at the expected path.
 *
 * Carries enough context for the CLI top-level catch to render a clear
 * `=== wolf: workspace not initialized ===` banner that even a non-technical
 * user can act on, and for MCP tool handlers to serialize a structured
 * `errorCode: WORKSPACE_NOT_INITIALIZED` response.
 */
export class WorkspaceNotInitializedError extends Error {
  readonly code = 'WORKSPACE_NOT_INITIALIZED' as const;

  constructor(
    /** Absolute path wolf tried to read from (e.g. `/Users/x/wolf`). */
    readonly workspacePath: string,
    /** Env var users can set to point wolf at a different path. */
    readonly envVarName: string,
    /** Init command appropriate for the current binary (stable vs. dev). */
    readonly initCommand: string,
  ) {
    super(
      `wolf workspace not initialized at ${workspacePath}. ` +
        `Run '${initCommand}' to set one up. ` +
        `(Set ${envVarName} to use a different directory.)`,
    );
    this.name = 'WorkspaceNotInitializedError';
  }
}
