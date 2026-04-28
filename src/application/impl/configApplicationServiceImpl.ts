import { loadConfig, saveConfig, backupConfig } from '../../utils/config.js';
import { getByPath, setByPath, coerceToShape } from '../../utils/dotPath.js';
import { AppConfigSchema } from '../../utils/schemas.js';
import type {
  ConfigApplicationService,
  ConfigSetResult,
} from '../configApplicationService.js';

export class ConfigApplicationServiceImpl implements ConfigApplicationService {
  async get(key: string): Promise<unknown> {
    const config = await loadConfig();
    const value = getByPath(config, key);
    if (value === undefined) {
      throw new Error(`Key not found in wolf.toml: ${key}`);
    }
    return value;
  }

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
}
