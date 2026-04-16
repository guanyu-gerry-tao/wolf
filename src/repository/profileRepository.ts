import type { UserProfile } from '../types/index.js';

export interface ProfileRepository {
  /** Get a profile by id. Returns null if not found. */
  get(id: string): Promise<UserProfile | null>;
  /** Get the default profile configured in wolf.toml. Throws if not found. */
  getDefault(): Promise<UserProfile>;
  /** List all profiles (by scanning profiles/ directory). */
  list(): Promise<UserProfile[]>;
  /** Read the resume pool markdown for a profile. */
  getResumePool(profileId: string): Promise<string>;
}
