import fs from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'smol-toml';
import { loadConfig, saveConfig, backupConfig } from '../../utils/config.js';
import { getByPath, setByPath, coerceToShape } from '../../utils/dotPath.js';
import { resolveWorkspaceDir } from '../../utils/instance.js';
import { UserProfileSchema } from '../../utils/schemas.js';
import type { UserProfile } from '../../types/index.js';

// `id` is the profile's directory name under profiles/<id>/. Changing it
// would orphan the folder, so we reject set operations on it.
const READ_ONLY_KEYS = new Set(['id']);

function profileTomlPath(profileId: string): string {
  return path.join(resolveWorkspaceDir(), 'profiles', profileId, 'profile.toml');
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

// Filesystem-safe IDs: letters, digits, hyphen, underscore. Must start with letter/digit
// so shells don't mistake leading hyphen for a flag.
function assertValidProfileId(id: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) {
    throw new Error(
      `Invalid profile id "${id}". Use letters, digits, hyphens, underscores; must start with a letter or digit.`,
    );
  }
}

// Write a UserProfile to disk preserving the init-time convention of writing
// null optional fields as empty strings so they remain visible in profile.toml.
async function writeProfile(profileDir: string, profile: UserProfile): Promise<void> {
  const serializable = {
    ...profile,
    firstUrl:     profile.firstUrl     ?? '',
    secondUrl:    profile.secondUrl    ?? '',
    thirdUrl:     profile.thirdUrl     ?? '',
    scoringNotes: profile.scoringNotes ?? '',
  };
  await fs.writeFile(
    path.join(profileDir, 'profile.toml'),
    stringify(serializable as unknown as Record<string, unknown>),
    'utf-8',
  );
}

/**
 * Lists every profile on disk, marking the default with `*`.
 * Unreadable profile.toml files show as "(unreadable)" instead of crashing the whole list.
 */
export async function profileList(): Promise<void> {
  const profilesDir = path.join(resolveWorkspaceDir(), 'profiles');
  let entries: string[] = [];
  try {
    entries = await fs.readdir(profilesDir);
  } catch {
    console.log('No profiles directory. Run `wolf init` first.');
    return;
  }

  const defaultId = await loadConfig()
    .then(c => c.defaultProfileId)
    .catch(() => undefined);

  if (entries.length === 0) {
    console.log('No profiles. Run `wolf init` or `wolf profile create <id>`.');
    return;
  }

  for (const id of entries.sort()) {
    const tomlPath = path.join(profilesDir, id, 'profile.toml');
    let name = '(unreadable)';
    try {
      const raw = await fs.readFile(tomlPath, 'utf-8');
      name = UserProfileSchema.parse(parse(raw)).name;
    } catch { /* leave name as "(unreadable)" */ }
    const marker = id === defaultId ? '*' : ' ';
    console.log(`${marker} ${id.padEnd(20)} ${name}`);
  }
}

/**
 * Creates a new profile under profiles/<id>/, cloning from another profile.
 * The source defaults to the current default profile so users rarely need --from.
 * The clone's `id` field is updated to match its new directory name.
 *
 * @throws If `id` is invalid, the target already exists, or the source profile is missing.
 */
export async function profileCreate(id: string, opts: { from?: string } = {}): Promise<void> {
  assertValidProfileId(id);

  const workspaceDir = resolveWorkspaceDir();
  const targetDir = path.join(workspaceDir, 'profiles', id);
  const targetExists = await fs.access(targetDir).then(() => true).catch(() => false);
  if (targetExists) {
    throw new Error(`Profile "${id}" already exists at ${targetDir}`);
  }

  const srcId = opts.from ?? (await loadConfig()
    .then(c => c.defaultProfileId)
    .catch(() => { throw new Error('No wolf.toml yet. Run `wolf init` first.'); }));

  const srcDir = path.join(workspaceDir, 'profiles', srcId);
  const srcTomlPath = path.join(srcDir, 'profile.toml');
  let srcRaw: string;
  try {
    srcRaw = await fs.readFile(srcTomlPath, 'utf-8');
  } catch {
    throw new Error(`Source profile "${srcId}" not found at ${srcTomlPath}`);
  }
  const srcProfile = UserProfileSchema.parse(parse(srcRaw));

  // Rewrite `id` so it matches the new directory; keep everything else as a starting point.
  const newProfile: UserProfile = { ...srcProfile, id, label: `${srcProfile.label} (copy)` };

  await fs.mkdir(targetDir, { recursive: true });
  await writeProfile(targetDir, newProfile);

  // Copy resume_pool.md if the source has one; it's the "big edit" most users clone for.
  try {
    await fs.copyFile(
      path.join(srcDir, 'resume_pool.md'),
      path.join(targetDir, 'resume_pool.md'),
    );
  } catch { /* source had no resume_pool.md; skip silently */ }

  console.log(`Created profile: ${id} (from "${srcId}")`);
}

/**
 * Switches the default profile by updating `defaultProfileId` in wolf.toml.
 * Verifies the target profile directory exists first so users don't break lookups.
 */
export async function profileUse(id: string): Promise<void> {
  const targetDir = path.join(resolveWorkspaceDir(), 'profiles', id);
  const exists = await fs.access(targetDir).then(() => true).catch(() => false);
  if (!exists) {
    throw new Error(`Profile "${id}" not found at ${targetDir}`);
  }

  const config = await loadConfig();
  const updated = { ...config, defaultProfileId: id };
  await backupConfig();
  await saveConfig(updated);
  console.log(`Default profile set to: ${id}`);
}

/**
 * Deletes a profile directory. Refuses to delete the current default (switch first)
 * and requires an explicit --yes to prevent accidents in scripts.
 */
export async function profileDelete(id: string, opts: { yes?: boolean } = {}): Promise<void> {
  const config = await loadConfig();
  if (id === config.defaultProfileId) {
    throw new Error(
      `Cannot delete the default profile "${id}". Switch defaults first: wolf profile use <other-id>`,
    );
  }

  const targetDir = path.join(resolveWorkspaceDir(), 'profiles', id);
  const exists = await fs.access(targetDir).then(() => true).catch(() => false);
  if (!exists) {
    throw new Error(`Profile "${id}" not found at ${targetDir}`);
  }

  if (!opts.yes) {
    throw new Error(
      `Refusing to delete ${targetDir} without --yes flag. ` +
      `Run: wolf profile delete ${id} --yes`,
    );
  }

  await fs.rm(targetDir, { recursive: true, force: true });
  console.log(`Deleted profile: ${id}`);
}
