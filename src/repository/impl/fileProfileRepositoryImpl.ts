import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';
import type { ProfileRepository } from '../profileRepository.js';
import type { Profile } from '../../types/index.js';
import { AppConfigSchema } from '../../utils/schemas.js';

/**
 * Reads profiles from `<workspace>/profiles/<name>/`. Each profile is a folder
 * with profile.md, resume_pool.md, standard_questions.md and an attachments/ dir.
 *
 * The default profile name comes from `wolf.toml.default`. If that field
 * points at a directory that doesn't exist, `getDefault()` throws — the user
 * either renamed the folder without updating wolf.toml, or wolf init wasn't run.
 */
export class FileProfileRepositoryImpl implements ProfileRepository {
  constructor(private readonly workspaceDir: string) {}

  private profileDir(name: string): string {
    return path.join(this.workspaceDir, 'profiles', name);
  }

  // True when the directory exists. Used to validate the wolf.toml.default
  // pointer and to short-circuit get() when the profile is absent.
  private async dirExists(name: string): Promise<boolean> {
    try {
      const stat = await fs.stat(this.profileDir(name));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async get(name: string): Promise<Profile | null> {
    if (!(await this.dirExists(name))) return null;
    const md = await this.getProfileMd(name);
    return { name, md };
  }

  async getDefault(): Promise<Profile> {
    const configPath = path.join(this.workspaceDir, 'wolf.toml');
    let raw: string;
    try {
      raw = await fs.readFile(configPath, 'utf-8');
    } catch {
      throw new Error('wolf.toml not found. Run wolf init to set up your workspace.');
    }
    const config = AppConfigSchema.parse(parse(raw));
    const defaultName = config.default;
    if (!defaultName) {
      throw new Error('wolf.toml is missing the `default` field. Run wolf init to repair your config.');
    }
    if (!(await this.dirExists(defaultName))) {
      throw new Error(
        `Default profile directory 'profiles/${defaultName}/' not found. ` +
        `Either rename a profile folder back to '${defaultName}', or run ` +
        `\`wolf profile use <name>\` to point wolf.toml at an existing profile.`,
      );
    }
    const md = await this.getProfileMd(defaultName);
    return { name: defaultName, md };
  }

  async list(): Promise<string[]> {
    const profilesDir = path.join(this.workspaceDir, 'profiles');
    let entries: string[];
    try {
      entries = await fs.readdir(profilesDir);
    } catch {
      return [];
    }
    // Only return entries that are themselves directories — protects against
    // stray files (e.g. .DS_Store) that might appear in profiles/.
    const dirs = await Promise.all(
      entries.map(async (entry): Promise<string | null> => {
        return (await this.dirExists(entry)) ? entry : null;
      }),
    );
    return dirs.filter((d): d is string => d !== null).sort();
  }

  async getProfileMd(name: string): Promise<string> {
    const mdPath = path.join(this.profileDir(name), 'profile.md');
    try {
      return await fs.readFile(mdPath, 'utf-8');
    } catch {
      throw new Error(
        `profile.md for profile '${name}' not found. Expected profiles/${name}/profile.md to exist. Run wolf init to create it.`,
      );
    }
  }

  async getResumePool(name: string): Promise<string> {
    const mdPath = path.join(this.profileDir(name), 'resume_pool.md');
    try {
      return await fs.readFile(mdPath, 'utf-8');
    } catch {
      throw new Error(
        `Resume pool for profile '${name}' not found. Expected profiles/${name}/resume_pool.md to exist. Run wolf init to create it.`,
      );
    }
  }

  async getStandardQuestions(name: string): Promise<string> {
    const mdPath = path.join(this.profileDir(name), 'standard_questions.md');
    try {
      return await fs.readFile(mdPath, 'utf-8');
    } catch {
      throw new Error(
        `standard_questions.md for profile '${name}' not found. Expected profiles/${name}/standard_questions.md to exist. Run wolf init to create it.`,
      );
    }
  }

  async getAttachmentsList(name: string): Promise<string[]> {
    const attachmentsDir = path.join(this.profileDir(name), 'attachments');
    let entries: string[];
    try {
      entries = await fs.readdir(attachmentsDir);
    } catch {
      // Missing attachments dir is fine — just no files to choose from.
      return [];
    }
    // Skip the README convention file so callers iterating the list to match
    // ATS uploads don't accidentally pick the documentation file.
    return entries
      .filter(entry => entry.toLowerCase() !== 'readme.md')
      .sort();
  }
}
