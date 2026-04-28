export interface EnvKeyStatus {
  key: string;
  value: string | null;
}

export interface EnvCleanupTarget {
  file: string;
  lines: string[];
}

export interface EnvSetOneResult {
  ok: boolean;
  target?: string;
  error?: string;
}

export interface EnvKeyInfo {
  prompt: string;
  purpose: string;
  howTo: string;
}

export interface EnvApplicationService {
  // The canonical list of WOLF_* keys this build manages.
  readonly keys: readonly string[];

  // Display metadata for each key (purpose, how-to-obtain).
  readonly keyInfo: Record<string, EnvKeyInfo>;

  // Returns one entry per managed key with its current process.env value
  // (or null when not set). Used by `wolf env show`.
  list(): EnvKeyStatus[];

  // Detects the shell rc file to write to based on $SHELL and platform.
  detectRcFile(): string;

  // Writes the entries into the rc file's `# wolf API keys` block, updating
  // existing exports in-place and appending the rest.
  writeBlock(rcFile: string, entries: { key: string; value: string }[]): Promise<void>;

  // Non-interactive single-key set. Validates the key against `keys` and the
  // value against emptiness; writes via writeBlock on success.
  setOne(key: string, value: string, rcFile?: string): Promise<EnvSetOneResult>;

  // Scans every candidate rc file for `export WOLF_*` lines.
  findExports(): Promise<EnvCleanupTarget[]>;

  // Rewrites each given rc file with WOLF_* export lines stripped.
  removeExports(files: string[]): Promise<void>;
}
