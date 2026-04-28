import type { AppConfig } from '../utils/types/index.js';

export interface WriteWorkspaceOptions {
  workspaceDir: string;
  config: AppConfig;
  overwriteConfig: boolean;
}

export interface InitApplicationService {
  // Builds the default AppConfig used by `wolf init`. Caller passes the
  // build mode so the dev marker can be embedded when applicable.
  buildDefaultConfig(mode?: 'stable' | 'dev'): AppConfig;

  // Lays down a fresh workspace skeleton: wolf.toml + default profile dir +
  // data/ + .gitignore + AI agent instructions. Idempotent: existing files
  // are preserved unless overwriteConfig is true.
  writeWorkspace(options: WriteWorkspaceOptions): Promise<void>;

  // The conventional name of the default profile directory.
  readonly defaultProfileName: string;
}
