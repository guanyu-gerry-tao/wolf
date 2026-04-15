import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';
import type { ProfileRepository } from '../profileRepository.js';
import type { UserProfile } from '../../types/index.js';
import { AppConfigSchema, UserProfileSchema } from '../../utils/schemas.js';

export class FileProfileRepositoryImpl implements ProfileRepository {
  constructor(private readonly workspaceDir: string) {}

  private profileDir(id: string): string {
    return path.join(this.workspaceDir, 'profiles', id);
  }

  async get(id: string): Promise<UserProfile | null> {
    const tomlPath = path.join(this.profileDir(id), 'profile.toml');
    let raw: string;
    try {
      raw = await fs.readFile(tomlPath, 'utf-8');
    } catch {
      return null;
    }
    const parsed = parse(raw);
    return UserProfileSchema.parse(parsed);
  }

  async getDefault(): Promise<UserProfile> {
    const configPath = path.join(this.workspaceDir, 'wolf.toml');
    let raw: string;
    try {
      raw = await fs.readFile(configPath, 'utf-8');
    } catch {
      throw new Error('wolf.toml not found. Run wolf init to set up your workspace.');
    }
    const config = AppConfigSchema.parse(parse(raw));
    const defaultId = config.defaultProfileId;
    if (!defaultId) {
      throw new Error('wolf.toml is missing defaultProfileId. Run wolf init to repair your config.');
    }
    const profile = await this.get(defaultId);
    if (!profile) {
      throw new Error(
        `Default profile '${defaultId}' not found. Expected profiles/${defaultId}/profile.toml to exist. Run wolf init to create it.`,
      );
    }
    return profile;
  }

  async list(): Promise<UserProfile[]> {
    const profilesDir = path.join(this.workspaceDir, 'profiles');
    let entries: string[];
    try {
      entries = await fs.readdir(profilesDir);
    } catch {
      return [];
    }
    const results = await Promise.all(entries.map(entry => this.get(entry)));
    return results.filter((p): p is UserProfile => p !== null);
  }

  async getResumePool(profileId: string): Promise<string> {
    const mdPath = path.join(this.profileDir(profileId), 'resume_pool.md');
    try {
      return await fs.readFile(mdPath, 'utf-8');
    } catch {
      throw new Error(
        `Resume pool for profile '${profileId}' not found. Expected profiles/${profileId}/resume_pool.md to exist. Run wolf init to create it.`,
      );
    }
  }
}
