import type { Profile } from '../utils/types/index.js';
import type { ProfileToml } from '../utils/profileToml.js';

/**
 * Reads profile data from `profiles/<name>/`. As of v2 a profile is a
 * directory holding:
 *   - profile.toml   — single-file structured profile (identity, contact,
 *                      address, links, job_preferences, demographics,
 *                      clearance, documents, skills,
 *                      [[experience]], [[project]], [[education]],
 *                      [[question]], various optional resume sections).
 *                      β.10g merged the former [form_answers] table into
 *                      [[question]] as builtin entries.
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

  /** Renders the unified [[question]] Q&A pool + document pointers as
   *  markdown. Used by fill (M4) and any prompt builder needing the
   *  application-time Q&A surface. */
  getStandardQuestions(name: string): Promise<string>;

  /** List attachment file names (relative to profiles/<name>/attachments/). */
  getAttachmentsList(name: string): Promise<string[]>;

  /**
   * Read the profile-level scoring guide (`profiles/<name>/score.md`). This
   * is appended to the score-system prompt so the user can steer AI tier
   * decisions with long-form prose. Returns an empty string if the file is
   * missing — score command treats that as "no extra steer".
   */
  getScoreMd(name: string): Promise<string>;

  /** Write `profiles/<name>/score.md`. Used by `wolf profile score edit`. */
  writeScoreMd(name: string, content: string): Promise<void>;

  /**
   * Idempotently create `profiles/<name>/score.md` with a placeholder
   * `> [!TODO]` header if the file does not yet exist. Mirrors the
   * `hint.md` pattern in tailor — leaves an editable, self-documenting
   * stub for the user.
   */
  ensureScoreMd(name: string): Promise<void>;
}
