import { createAppContext, type AppContext } from '../../runtime/appContext.js';

/**
 * Prints the value at a dot-path key in wolf.toml.
 * Scalars print raw (pipe-friendly); arrays/objects print as JSON.
 *
 * @throws If the key does not exist in the loaded config.
 */
export async function configGet(
  key: string,
  ctx: AppContext = createAppContext(),
): Promise<void> {
  const value = await ctx.configApp.get(key);
  printValue(value);
}

/**
 * Writes `valueStr` at `key` in wolf.toml.
 *
 * @throws If coercion fails or the resulting config violates the schema.
 */
export async function configSet(
  key: string,
  valueStr: string,
  ctx: AppContext = createAppContext(),
): Promise<void> {
  const { coerced } = await ctx.configApp.set(key, valueStr);
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
