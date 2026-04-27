import type { Profile } from '../types/index.js';

/**
 * Reads profile data from `profiles/<name>/`. A profile is a directory holding:
 *   - profile.md             — identity facts (name, contact, address, demographics, work auth, clearance)
 *   - resume_pool.md         — full experience bank (consumed by tailor)
 *   - standard_questions.md  — application-only Q&A + document pointers
 *   - attachments/           — files referenced by standard_questions.md
 *
 * The default profile is whichever directory `wolf.toml.default` points at;
 * `getDefault()` throws if that directory doesn't exist.
 */
export interface ProfileRepository {
  /** Get a profile by directory name. Returns null if the directory doesn't exist. */
  get(name: string): Promise<Profile | null>;

  /** Get the default profile per `wolf.toml.default`. Throws if missing. */
  getDefault(): Promise<Profile>;

  /** List all profile directory names (sorted). */
  list(): Promise<string[]>;

  /** Read profile.md text — same as `(await get(name))?.md`, errors if absent. */
  getProfileMd(name: string): Promise<string>;

  /** Read the resume pool markdown for a profile. */
  getResumePool(name: string): Promise<string>;

  /** Read standard_questions.md for a profile. */
  getStandardQuestions(name: string): Promise<string>;

  /** List attachment file names (relative to profiles/<name>/attachments/). */
  getAttachmentsList(name: string): Promise<string[]>;
}
