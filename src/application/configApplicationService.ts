/**
 * Result of `set` — the dot-path key that was written and the runtime-typed
 * value that landed in `wolf.toml` after coercion. The CLI uses this to print
 * a confirmation line.
 */
export interface ConfigSetResult {
  key: string;
  coerced: unknown;
}

export interface WorkspaceConfigView {
  default: string;
  hunt: {
    minScore: number;
    maxResults: number;
  };
  tailor: {
    model: string;
    defaultCoverLetterTone: string;
  };
  score: {
    model: string;
  };
  reach: {
    model: string;
    defaultEmailTone: string;
    maxEmailsPerDay: number;
  };
  fill: {
    model: string;
  };
}

export type WorkspaceConfigUpdate = Partial<WorkspaceConfigView>;

/**
 * Use case for `wolf config get/set` — typed dot-path access to `wolf.toml`.
 * Reads validate that the key exists; writes coerce the input string to the
 * target field's existing runtime shape and re-validate the whole config
 * through Zod before persisting (with a rolling backup).
 */
export interface ConfigApplicationService {
  /**
   * Reads `wolf.toml[<key>]` where `<key>` is a dot path (e.g. `tailor.model`).
   *
   * @throws If the key is absent — never returns `undefined`.
   */
  get(key: string): Promise<unknown>;

  /**
   * Coerces `valueStr` to the existing field's runtime shape, validates the
   * resulting config via the AppConfig Zod schema, backs up the current
   * `wolf.toml` to `wolf.toml.backup1`, then writes.
   *
   * @throws If coercion fails or the resulting config violates the schema.
   */
  set(key: string, valueStr: string): Promise<ConfigSetResult>;

  /** Reads the form-shaped workspace settings used by the wolf companion side panel. */
  getWorkspaceConfig(): Promise<WorkspaceConfigView>;

  /** Writes the workspace settings submitted from the side panel. */
  updateWorkspaceConfig(update: WorkspaceConfigUpdate): Promise<WorkspaceConfigView>;

  /** Resets side-panel-editable workspace settings to the TS defaults. */
  resetWorkspaceConfig(): Promise<WorkspaceConfigView>;
}
