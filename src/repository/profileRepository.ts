import type { Profile } from '../utils/types/index.js';
import type { ProfileToml } from '../utils/profileToml.js';

/**
 * Reads profile data from `profiles/<name>/`. As of v2 a profile is a
 * directory holding:
 *   - profile.toml   — single-file structured profile (identity, contact,
 *                      address, links, job_preferences, demographics,
 *                      clearance, form_answers, documents, skills,
 *                      [[experience]], [[project]], [[education]],
 *                      [[question]], various optional resume sections)
 *   - attachments/   — files referenced by documents.* (transcript, etc.)
 *
 * The legacy v1 markdown trio (profile.md / resume_pool.md /
 * standard_questions.md) was migrated to this single TOML by `wolf
 * migrate`. Older `getProfileMd` / `getResumePool` / `getStandardQuestions`
 * methods now RENDER markdown views from the parsed TOML so existing AI
 * prompt builders (tailor, fill, reach) keep working without rewrites.
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

  /**
   * Returns the parsed profile.toml as a typed object. Used by `wolf doctor`,
   * `wolf profile fields`, and any code that needs structured access to
   * specific TOML fields (without rendering the whole thing as markdown).
   */
  getProfileToml(name: string): Promise<ProfileToml>;

  /** Renders the profile (identity / contact / job_preferences / etc.) as
   *  markdown. Used by tailor's analyst / cover-letter prompt builders. */
  getProfileMd(name: string): Promise<string>;

  /** Renders the resume content (experience / projects / skills / etc.) as
   *  markdown. Used by tailor's analyst pool input. */
  getResumePool(name: string): Promise<string>;

  /** Renders form answers + behavioural stories + document pointers as
   *  markdown. Used by fill (M4) and any prompt builder needing the
   *  application-time Q&A surface. */
  getStandardQuestions(name: string): Promise<string>;

  /** List attachment file names (relative to profiles/<name>/attachments/). */
  getAttachmentsList(name: string): Promise<string[]>;
}
