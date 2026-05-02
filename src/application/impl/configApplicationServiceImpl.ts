import { loadConfig, saveConfig, backupConfig } from '../../utils/config.js';
import { getByPath, setByPath, coerceToShape } from '../../utils/dotPath.js';
import { AppConfigSchema } from '../../utils/schemas.js';
import { DEFAULT_WORKSPACE_CONFIG } from '../../utils/appConfigDefaults.js';
import type { AppConfig } from '../../utils/types/index.js';
import type {
  ConfigApplicationService,
  ConfigSetResult,
  WorkspaceConfigUpdate,
  WorkspaceConfigView,
} from '../configApplicationService.js';

/**
 * File-backed `ConfigApplicationService`. Stateless — every call re-reads
 * `wolf.toml` from the resolved workspace; writes go through `backupConfig`
 * + `saveConfig` so the previous file is preserved as `wolf.toml.backup1`.
 */
export class ConfigApplicationServiceImpl implements ConfigApplicationService {
  /** @inheritdoc */
  async get(key: string): Promise<unknown> {
    const config = await loadConfig();
    const value = getByPath(config, key);
    if (value === undefined) {
      throw new Error(`Key not found in wolf.toml: ${key}`);
    }
    return value;
  }

  /** @inheritdoc */
  async set(key: string, valueStr: string): Promise<ConfigSetResult> {
    const config = await loadConfig();
    const coerced = coerceToShape(valueStr, getByPath(config, key));
    const updated = setByPath(config, key, coerced);
    // Zod re-validation catches type mismatches and constraint violations.
    const validated = AppConfigSchema.parse(updated);
    await backupConfig();
    await saveConfig(validated);
    return { key, coerced };
  }

  /** @inheritdoc */
  async getWorkspaceConfig(): Promise<WorkspaceConfigView> {
    const config = AppConfigSchema.parse(await loadConfig());
    return toWorkspaceConfigView(config);
  }

  /** @inheritdoc */
  async updateWorkspaceConfig(update: WorkspaceConfigUpdate): Promise<WorkspaceConfigView> {
    const config = AppConfigSchema.parse(await loadConfig());
    const updated = AppConfigSchema.parse({
      ...config,
      default: update.default ?? config.default,
      hunt: { ...config.hunt, ...update.hunt },
      tailor: { ...config.tailor, ...update.tailor },
      score: { ...config.score, ...update.score },
      reach: { ...config.reach, ...update.reach },
      fill: { ...config.fill, ...update.fill },
    });
    await backupConfig();
    await saveConfig(updated);
    return toWorkspaceConfigView(updated);
  }

  /** @inheritdoc */
  async resetWorkspaceConfig(): Promise<WorkspaceConfigView> {
    const config = AppConfigSchema.parse(await loadConfig());
    const updated = AppConfigSchema.parse({
      ...config,
      ...DEFAULT_WORKSPACE_CONFIG,
    });
    await backupConfig();
    await saveConfig(updated);
    return toWorkspaceConfigView(updated);
  }
}

function toWorkspaceConfigView(config: AppConfig): WorkspaceConfigView {
  return {
    default: config.default,
    hunt: config.hunt,
    tailor: config.tailor,
    score: config.score,
    reach: config.reach,
    fill: config.fill,
  };
}
