import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { AppConfig } from '../types/index.js';

/** Absolute path to the user's wolf config file. */
const CONFIG_PATH = path.join(os.homedir(), '.wolf', 'config.json');

/**
 * Loads the user config from `~/.wolf/config.json`.
 *
 * @throws If the file does not exist or cannot be parsed.
 * Run `wolf init` to create it.
 */
export async function loadConfig(): Promise<AppConfig> {
  const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw) as AppConfig;
}

/**
 * Writes the given config to `~/.wolf/config.json`.
 * Creates the directory if it does not exist.
 *
 * @param config - The full config object to persist.
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
