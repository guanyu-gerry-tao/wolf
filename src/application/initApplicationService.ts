import type { AppConfig } from '../utils/types/index.js';

/**
 * Arguments for `writeWorkspace`. `overwriteConfig=true` replaces an existing
 * `wolf.toml` after backing it up; `false` preserves whatever is on disk.
 */
export interface WriteWorkspaceOptions {
  workspaceDir: string;
  config: AppConfig;
  overwriteConfig: boolean;
}

/**
 * Use case for `wolf init` — lays down a fresh wolf workspace skeleton.
 * Idempotent: existing files are preserved (template files won't clobber
 * user edits) unless `overwriteConfig` is set, in which case `wolf.toml` is
 * replaced after a backup.
 *
 * Important: this service runs **before** `wolf.toml` exists, which means
 * it cannot live behind a fully-wired `AppContext` (createAppContext loads
 * the toml synchronously). The CLI wrapper instantiates it as a module
 * singleton.
 */
export interface InitApplicationService {
  /**
   * Builds the default `AppConfig` used by `wolf init`. Caller passes the
   * build mode so the dev marker (`instance.mode = "dev"`) is embedded only
   * when applicable.
   */
  buildDefaultConfig(mode?: 'stable' | 'dev'): AppConfig;

  /**
   * Lays down the workspace skeleton: `wolf.toml`, default profile dir
   * (with the four template MD files + `attachments/`), `data/`,
   * `.gitignore`, and `CLAUDE.md` / `AGENTS.md`. Each file is written
   * only if absent, except `wolf.toml` when `overwriteConfig=true`.
   */
  writeWorkspace(options: WriteWorkspaceOptions): Promise<void>;

  /** The conventional name of the default profile directory (`"default"`). */
  readonly defaultProfileName: string;
}
