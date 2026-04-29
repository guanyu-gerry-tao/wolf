import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, saveConfig, backupConfig } from '../../utils/config.js';
import { resolveWorkspaceDir, currentBinaryName, workspaceEnvVarName } from '../../utils/instance.js';
import { WorkspaceNotInitializedError } from '../../utils/errors/workspaceNotInitializedError.js';
import type {
  ProfileApplicationService,
  ProfileListResult,
  ProfileCreateResult,
} from '../profileApplicationService.js';

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
 * Filesystem-backed `ProfileApplicationService`. Operates directly on
 * `profiles/<name>/` directories under the resolved workspace and on
 * `wolf.toml.default`. No DB / repo deps; all I/O is through node's `fs`.
 */
export class ProfileApplicationServiceImpl implements ProfileApplicationService {
  /** @inheritdoc */
  async list(): Promise<ProfileListResult> {
    const profilesDir = path.join(resolveWorkspaceDir(), 'profiles');
    let entries: string[] = [];
    try {
      entries = await fs.readdir(profilesDir);
    } catch {
      return { kind: 'no-profiles-dir' };
    }

    const defaultName = await loadConfig()
      .then(c => c.default)
      .catch(() => undefined);

    // Filter to actual directories — skip stray files like .DS_Store.
    const dirs: string[] = [];
    for (const entry of entries) {
      if (await dirExists(path.join(profilesDir, entry))) dirs.push(entry);
    }

    if (dirs.length === 0) return { kind: 'empty' };

    const profiles = dirs.sort().map((name) => ({
      name,
      isDefault: name === defaultName,
    }));
    return { kind: 'ok', profiles };
  }

  /** @inheritdoc */
  async create(name: string, opts: { from?: string } = {}): Promise<ProfileCreateResult> {
    assertValidProfileName(name);

    const targetDir = profileDir(name);
    if (await dirExists(targetDir)) {
      throw new Error(`Profile "${name}" already exists at ${targetDir}`);
    }

    const srcName = opts.from ?? (await loadConfig()
      .then(c => c.default)
      // Surface the same typed error other workspace-read sites use so the
      // CLI banner / MCP structured response render uniformly across commands.
      .catch(() => {
        throw new WorkspaceNotInitializedError(
          resolveWorkspaceDir(),
          workspaceEnvVarName(),
          `${currentBinaryName()} init`,
        );
      }));

    const srcDir = profileDir(srcName);
    if (!(await dirExists(srcDir))) {
      throw new Error(`Source profile "${srcName}" not found at ${srcDir}`);
    }

    await fs.mkdir(targetDir, { recursive: true });

    // Each MD file is independent — missing source files just skip silently
    // so a partial source profile still clones.
    for (const filename of PROFILE_FILES) {
      try {
        await fs.copyFile(path.join(srcDir, filename), path.join(targetDir, filename));
      } catch { /* source missing this file; skip */ }
    }

    try {
      await fs.cp(
        path.join(srcDir, ATTACHMENTS_DIR),
        path.join(targetDir, ATTACHMENTS_DIR),
        { recursive: true },
      );
    } catch { /* source had no attachments dir; skip */ }

    return { name, from: srcName, targetDir };
  }

  /** @inheritdoc */
  async use(name: string): Promise<void> {
    const targetDir = profileDir(name);
    if (!(await dirExists(targetDir))) {
      throw new Error(`Profile "${name}" not found at ${targetDir}`);
    }

    const config = await loadConfig();
    const updated = { ...config, default: name };
    await backupConfig();
    await saveConfig(updated);
  }

  /** @inheritdoc */
  async delete(name: string, opts: { yes?: boolean } = {}): Promise<string> {
    const config = await loadConfig();
    if (name === config.default) {
      throw new Error(
        `Cannot delete the default profile "${name}". Switch defaults first: \`${currentBinaryName()} profile use <other-name>\``,
      );
    }

    const targetDir = profileDir(name);
    if (!(await dirExists(targetDir))) {
      throw new Error(`Profile "${name}" not found at ${targetDir}`);
    }

    if (!opts.yes) {
      throw new Error(
        `Refusing to delete ${targetDir} without --yes flag. ` +
        `Run: \`${currentBinaryName()} profile delete ${name} --yes\``,
      );
    }

    await fs.rm(targetDir, { recursive: true, force: true });
    return targetDir;
  }
}
