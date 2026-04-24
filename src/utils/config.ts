import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'smol-toml';
import type { AppConfig } from '../types/index.js';
import { AppConfigSchema } from './schemas.js';
import { resolveWorkspaceDir } from './instance.js';

/** Returns the path to wolf.toml in the resolved stable/dev workspace. */
const configPath = (workspaceDir = resolveWorkspaceDir()) => path.join(workspaceDir, 'wolf.toml');

/**
 * Synchronous variant used by createAppContext() which must remain sync
 * due to the default-parameter pattern in commands.
 * Falls back to a minimal config with schema defaults when wolf.toml is absent or unreadable.
 */
export function loadConfigSync(): AppConfig {
  try {
    const raw = fsSync.readFileSync(configPath(), 'utf-8');
    return AppConfigSchema.parse(parse(raw));
  } catch {
    // wolf.toml absent or unparseable — return a minimal config using schema defaults.
    // defaultProfileId falls back to 'default'; other fields use their zod defaults.
    return AppConfigSchema.parse({
      defaultProfileId: 'default',
      hunt: {},
      tailor: {},
      reach: {},
    });
  }
}

/**
 * Loads the user config from `wolf.toml` in the current working directory.
 *
 * @throws If `wolf.toml` does not exist — run `wolf init` first.
 * @throws If the file cannot be parsed.
 */
export async function loadConfig(): Promise<AppConfig> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath(), 'utf-8');
  } catch {
    throw new Error('wolf.toml not found. Run wolf init to set up your workspace.');
  }
  const parsed = parse(raw);
  return AppConfigSchema.parse(parsed);
}

/**
 * Writes the given config to `wolf.toml` in the current working directory.
 *
 * @param config - The full config object to persist.
 */
export async function saveConfig(config: AppConfig, workspaceDir?: string): Promise<void> {
  await fs.mkdir(workspaceDir ?? resolveWorkspaceDir(), { recursive: true });
  await fs.writeFile(configPath(workspaceDir), stringify(config as unknown as Record<string, unknown>), 'utf-8');
}

/**
 * Rotates wolf.toml backups before an overwrite, keeping up to 5 copies.
 *
 * Backup numbering: wolf.toml.backup1 is always the most recent.
 * On each call: backup4 → backup5, backup3 → backup4, ..., wolf.toml → backup1.
 *
 * Call this before saveConfig() whenever you are overwriting an existing config.
 */
export async function backupConfig(workspaceDir?: string): Promise<void> {
  for (let i = 4; i >= 1; i--) {
    const src = `${configPath(workspaceDir)}.backup${i}`;
    const dst = `${configPath(workspaceDir)}.backup${i + 1}`;
    try { await fs.rename(src, dst); } catch { /* slot empty, skip */ }
  }
  try { await fs.copyFile(configPath(workspaceDir), `${configPath(workspaceDir)}.backup1`); } catch { /* no wolf.toml yet */ }
}
