/**
 * One row of the `wolf env show` table: a managed key and whether it's set
 * in the current process environment (`null` when absent).
 */
export interface EnvKeyStatus {
  key: string;
  value: string | null;
}

/**
 * One match found by `wolf env clear`'s scan: a shell rc file plus the
 * `export WOLF_*` lines inside it that will be removed.
 */
export interface EnvCleanupTarget {
  file: string;
  lines: string[];
}

/**
 * Result of a non-interactive single-key write. `ok=false` carries a
 * user-facing `error` message; `ok=true` carries the resolved rc file path.
 */
export interface EnvSetOneResult {
  ok: boolean;
  target?: string;
  error?: string;
}

/**
 * Display metadata used by the interactive `wolf env set` flow to render the
 * info page and per-key prompts.
 */
export interface EnvKeyInfo {
  prompt: string;
  purpose: string;
  howTo: string;
}

/**
 * Use case for `wolf env show / set / clear` — manages `WOLF_*` API keys in
 * the user's shell rc file. wolf intentionally avoids `.env` files because
 * the workspace can be cloud-synced or shared with resume PDFs.
 *
 * The application service is stateless and has no DB / repo dependencies,
 * so the CLI wrapper instantiates it as a module singleton (creating a full
 * `AppContext` would force a SQLite open just to write a shell file).
 */
export interface EnvApplicationService {
  /** The canonical list of WOLF_* keys this build manages. */
  readonly keys: readonly string[];

  /** Display metadata for each key (purpose, how-to-obtain). */
  readonly keyInfo: Record<string, EnvKeyInfo>;

  /**
   * Returns one entry per managed key with its current `process.env` value
   * (or `null` when not set). Used by `wolf env show`.
   */
  list(): EnvKeyStatus[];

  /**
   * Detects which shell rc file to write to based on `$SHELL` and platform.
   * Falls back to `~/.zshrc` for unrecognized shells.
   */
  detectRcFile(): string;

  /**
   * Writes the given entries into the rc file's `# wolf API keys` block.
   * Updates existing `export WOLF_*` lines in place; appends a new block at
   * the end for any key not already present.
   */
  writeBlock(rcFile: string, entries: { key: string; value: string }[]): Promise<void>;

  /**
   * Non-interactive single-key set used by `wolf env set <key> <value>`.
   * Validates the key against `keys` and the value against emptiness;
   * writes via `writeBlock` on success.
   */
  setOne(key: string, value: string, rcFile?: string): Promise<EnvSetOneResult>;

  /**
   * Scans every candidate rc file for `export WOLF_*` lines. Missing files
   * are silently skipped — not every user has every rc file.
   */
  findExports(): Promise<EnvCleanupTarget[]>;

  /**
   * Rewrites each given rc file with all `export WOLF_*` lines stripped.
   * Other lines (comments, non-wolf exports) are preserved verbatim.
   */
  removeExports(files: string[]): Promise<void>;
}
