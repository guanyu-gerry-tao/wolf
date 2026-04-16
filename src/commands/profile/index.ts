import fs from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'smol-toml';
import { loadConfig } from '../../utils/config.js';
import { getByPath, setByPath, coerceToShape } from '../../utils/dotPath.js';
import { UserProfileSchema } from '../../utils/schemas.js';
import type { UserProfile } from '../../types/index.js';

// `id` is the profile's directory name under profiles/<id>/. Changing it
// would orphan the folder, so we reject set operations on it.
const READ_ONLY_KEYS = new Set(['id']);

function profileTomlPath(profileId: string): string {
  return path.join(process.cwd(), 'profiles', profileId, 'profile.toml');
}

async function readProfile(profileId: string): Promise<{ profile: UserProfile; tomlPath: string }> {
  const tomlPath = profileTomlPath(profileId);
  let raw: string;
  try {
    raw = await fs.readFile(tomlPath, 'utf-8');
  } catch {
    throw new Error(`Profile '${profileId}' not found at ${tomlPath}`);
  }
  return { profile: UserProfileSchema.parse(parse(raw)), tomlPath };
}

// Falls back to defaultProfileId from wolf.toml when no override is passed.
async function resolveProfileId(override?: string): Promise<string> {
  if (override) return override;
  const config = await loadConfig();
  return config.defaultProfileId;
}

/**
 * Prints the value at a dot-path key in profiles/<id>/profile.toml.
 * Scalars print raw (pipe-friendly), null as empty line, everything else JSON.
 */
export async function profileGet(key: string, profileId?: string): Promise<void> {
  const id = await resolveProfileId(profileId);
  const { profile } = await readProfile(id);
  const value = getByPath(profile, key);
  if (value === undefined) {
    throw new Error(`Key not found in profile '${id}': ${key}`);
  }
  printValue(value);
}

/**
 * Writes `valueStr` at `key` in the resolved profile's profile.toml.
 * Coerces to the field's current runtime type and re-validates via Zod.
 *
 * @throws If `key` is read-only, coercion fails, or the result violates the schema.
 */
export async function profileSet(key: string, valueStr: string, profileId?: string): Promise<void> {
  if (READ_ONLY_KEYS.has(key)) {
    throw new Error(`Cannot set read-only field: ${key}`);
  }
  const id = await resolveProfileId(profileId);
  const { profile, tomlPath } = await readProfile(id);
  const coerced = coerceToShape(valueStr, getByPath(profile, key));
  const updated = setByPath(profile, key, coerced);
  const validated = UserProfileSchema.parse(updated);
  // init writes null optional fields as "" so they stay visible in the TOML;
  // preserve that convention on rewrites.
  const serializable = {
    ...validated,
    firstUrl:     validated.firstUrl     ?? '',
    secondUrl:    validated.secondUrl    ?? '',
    thirdUrl:     validated.thirdUrl     ?? '',
    scoringNotes: validated.scoringNotes ?? '',
  };
  await fs.writeFile(tomlPath, stringify(serializable as unknown as Record<string, unknown>), 'utf-8');
  console.log(`Set ${key} = ${formatValue(coerced)}`);
}

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
