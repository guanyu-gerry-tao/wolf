import { loadConfig, saveConfig, backupConfig } from '../../utils/config.js';
import { getByPath, setByPath, coerceToShape } from '../../utils/dotPath.js';
import { AppConfigSchema } from '../../utils/schemas.js';

/**
 * Prints the value at a dot-path key in wolf.toml.
 * Scalars print raw (pipe-friendly); arrays/objects print as JSON.
 *
 * @throws If the key does not exist in the loaded config.
 */
export async function configGet(key: string): Promise<void> {
  const config = await loadConfig();
  const value = getByPath(config, key);
  if (value === undefined) {
    throw new Error(`Key not found in wolf.toml: ${key}`);
  }
  printValue(value);
}

/**
 * Writes `valueStr` at `key` in wolf.toml. Coerces to the field's current
 * runtime type (number/boolean/array/string), re-validates through the Zod
 * schema, backs up the original, then saves.
 *
 * @throws If coercion fails or the resulting config violates the schema.
 */
export async function configSet(key: string, valueStr: string): Promise<void> {
  const config = await loadConfig();
  const coerced = coerceToShape(valueStr, getByPath(config, key));
  const updated = setByPath(config, key, coerced);
  // Zod re-validation catches type mismatches and constraint violations.
  const validated = AppConfigSchema.parse(updated);
  await backupConfig();
  await saveConfig(validated);
  console.log(`Set ${key} = ${formatValue(coerced)}`);
}

// Scalars print raw so output is pipe-friendly; everything else goes as JSON
// to keep the format unambiguous.
function printValue(v: unknown): void {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    console.log(v);
  } else if (v === null) {
    console.log('');
  } else {
    console.log(JSON.stringify(v));
  }
}

function formatValue(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v);
}
