import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, saveConfig, backupConfig } from '../../utils/config.js';
import { resolveWorkspaceDir } from '../../utils/instance.js';

// Files that compose a profile directory. `wolf profile create` clones each one
// from the source profile (any missing one is silently skipped).
const PROFILE_FILES = [
  'profile.md',
  'resume_pool.md',
  'standard_questions.md',
] as const;

const ATTACHMENTS_DIR = 'attachments';

// Filesystem-safe names: letters, digits, hyphen, underscore. Must start with
// letter/digit so shells don't mistake leading hyphen for a flag.
function assertValidProfileName(name: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error(
      `Invalid profile name "${name}". Use letters, digits, hyphens, underscores; must start with a letter or digit.`,
    );
  }
}

function profileDir(name: string): string {
  return path.join(resolveWorkspaceDir(), 'profiles', name);
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Lists every profile directory under profiles/, marking the default with `*`.
 * Pure directory-level operation — does not parse any markdown.
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

  // The default name comes from wolf.toml; missing config means no marker.
  const defaultName = await loadConfig()
    .then(c => c.default)
    .catch(() => undefined);

  // Filter to actual directories — skip stray files like .DS_Store.
  const dirs: string[] = [];
  for (const entry of entries) {
    if (await dirExists(path.join(profilesDir, entry))) dirs.push(entry);
  }

  if (dirs.length === 0) {
    console.log('No profiles. Run `wolf init` or `wolf profile create <name>`.');
    return;
  }

  for (const name of dirs.sort()) {
    const marker = name === defaultName ? '*' : ' ';
    console.log(`${marker} ${name}`);
  }
}

/**
 * Creates a new profile under profiles/<name>/, cloning all four MD files +
 * the attachments/ folder from the source profile (the current default unless
 * --from is given).
 *
 * @throws If `name` is invalid, the target already exists, or the source profile is missing.
 */
export async function profileCreate(name: string, opts: { from?: string } = {}): Promise<void> {
  assertValidProfileName(name);

  const targetDir = profileDir(name);
  if (await dirExists(targetDir)) {
    throw new Error(`Profile "${name}" already exists at ${targetDir}`);
  }

  const srcName = opts.from ?? (await loadConfig()
    .then(c => c.default)
    .catch(() => { throw new Error('No wolf.toml yet. Run `wolf init` first.'); }));

  const srcDir = profileDir(srcName);
  if (!(await dirExists(srcDir))) {
    throw new Error(`Source profile "${srcName}" not found at ${srcDir}`);
  }

  await fs.mkdir(targetDir, { recursive: true });

  // Clone the three top-level MD files. Each is independent — missing source
  // files just skip silently so a partial source profile still clones.
  for (const filename of PROFILE_FILES) {
    try {
      await fs.copyFile(path.join(srcDir, filename), path.join(targetDir, filename));
    } catch { /* source missing this file; skip */ }
  }

  // Clone the entire attachments/ folder if it exists. fs.cp is recursive
  // since Node 16.7+ and handles missing source by throwing — caught below.
  try {
    await fs.cp(
      path.join(srcDir, ATTACHMENTS_DIR),
      path.join(targetDir, ATTACHMENTS_DIR),
      { recursive: true },
    );
  } catch { /* source had no attachments dir; skip */ }

  console.log(`Created profile: ${name} (cloned from "${srcName}")`);
}

/**
 * Switches the default profile by updating `wolf.toml.default`.
 * Verifies the target profile directory exists first — per the design,
 * a missing default is a hard error at read time, so we refuse to set
 * the pointer to something that won't resolve.
 */
export async function profileUse(name: string): Promise<void> {
  const targetDir = profileDir(name);
  if (!(await dirExists(targetDir))) {
    throw new Error(`Profile "${name}" not found at ${targetDir}`);
  }

  const config = await loadConfig();
  const updated = { ...config, default: name };
  await backupConfig();
  await saveConfig(updated);
  console.log(`Default profile set to: ${name}`);
}

/**
 * Deletes a profile directory. Refuses to delete the current default (switch first)
 * and requires an explicit --yes to prevent accidents in scripts.
 */
export async function profileDelete(name: string, opts: { yes?: boolean } = {}): Promise<void> {
  const config = await loadConfig();
  if (name === config.default) {
    throw new Error(
      `Cannot delete the default profile "${name}". Switch defaults first: wolf profile use <other-name>`,
    );
  }

  const targetDir = profileDir(name);
  if (!(await dirExists(targetDir))) {
    throw new Error(`Profile "${name}" not found at ${targetDir}`);
  }

  if (!opts.yes) {
    throw new Error(
      `Refusing to delete ${targetDir} without --yes flag. ` +
      `Run: wolf profile delete ${name} --yes`,
    );
  }

  await fs.rm(targetDir, { recursive: true, force: true });
  console.log(`Deleted profile: ${name}`);
}
