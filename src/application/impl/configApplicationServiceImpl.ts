import { loadConfig, saveConfig, backupConfig } from '../../utils/config.js';
import { getByPath, setByPath, coerceToShape } from '../../utils/dotPath.js';
import { AppConfigSchema } from '../../utils/schemas.js';
import type { AppConfig } from '../../utils/types/index.js';
import type {
  CompanionConfigUpdate,
  CompanionConfigView,
  ConfigApplicationService,
  ConfigSetResult,
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
  async getCompanionConfig(): Promise<CompanionConfigView> {
    const config = AppConfigSchema.parse(await loadConfig());
    return toCompanionConfigView(config);
  }

  /** @inheritdoc */
  async updateCompanionConfig(update: CompanionConfigUpdate): Promise<CompanionConfigView> {
    const config = AppConfigSchema.parse(await loadConfig());
    const updated = AppConfigSchema.parse({
      ...config,
      default: update.defaultProfile ?? config.default,
      companion: {
        ...config.companion,
        servePort: update.servePort ?? config.companion.servePort,
        maxStagehandSessions: update.maxStagehandSessions ?? config.companion.maxStagehandSessions,
        browserMode: update.browserMode ?? config.companion.browserMode,
      },
    });
    await backupConfig();
    await saveConfig(updated);
    return toCompanionConfigView(updated);
  }
}

function toCompanionConfigView(config: AppConfig): CompanionConfigView {
  return {
    defaultProfile: config.default,
    servePort: config.companion.servePort,
    maxStagehandSessions: config.companion.maxStagehandSessions,
    browserMode: config.companion.browserMode,
    aiModel: config.tailor.model,
    fillModel: config.fill.model,
  };
}
