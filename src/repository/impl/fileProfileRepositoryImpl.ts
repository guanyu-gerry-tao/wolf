import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';
import type { ProfileRepository } from '../profileRepository.js';
import type { Profile } from '../../utils/types/index.js';
import { AppConfigSchema } from '../../utils/schemas.js';
import { WorkspaceNotInitializedError } from '../../utils/errors/workspaceNotInitializedError.js';
import { workspaceEnvVarName, currentBinaryName } from '../../utils/instance.js';
import {
  parseProfileToml,
  type ProfileToml,
} from '../../utils/profileToml.js';
import {
  renderProfileMarkdown,
  renderResumePoolMarkdown,
  renderStandardQuestionsMarkdown,
} from '../../utils/profileTomlRender.js';

/**
 * Reads profiles from `<workspace>/profiles/<name>/`. As of v2 each profile
 * is a directory with a single `profile.toml` plus an `attachments/` dir.
 *
 * The default profile name comes from `wolf.toml.default`. If that field
 * points at a directory that doesn't exist, `getDefault()` throws — the user
 * either renamed the folder without updating wolf.toml, or wolf init wasn't run.
 *
 * # v2 read path
 *
 * `getProfileToml` returns the parsed structured object directly. The
 * legacy `getProfileMd` / `getResumePool` / `getStandardQuestions` methods
 * read profile.toml and *render* their respective markdown views via
 * `profileTomlRender`. Existing AI prompt builders that call these methods
 * keep working without changes; over time they'll migrate to consuming
 * `ProfileToml` directly.
 *
 * # v1 workspaces
 *
 * If a profile directory still has the old .md trio (no profile.toml), the
 * accessors throw a clear error pointing at `wolf migrate`. The migration
 * runtime is the only blessed path to v2.
 */
export class FileProfileRepositoryImpl implements ProfileRepository {
  // Cache the parsed TOML per name so multi-method calls (e.g. tailor calling
  // getProfileMd + getResumePool + getStandardQuestions) parse once. Cleared
  // implicitly when the repo instance is rebuilt (which happens per-command
  // via createAppContext). No invalidation logic — single-process CLI usage
  // means the on-disk file doesn't mutate while we hold the parsed object.
  private readonly tomlCache = new Map<string, ProfileToml>();

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
      // Same typed error surfaced from `loadConfig` so both entry points
      // produce the same structured "workspace not initialized" signal.
      throw new WorkspaceNotInitializedError(
        this.workspaceDir,
        workspaceEnvVarName(),
        `${currentBinaryName()} init`,
      );
    }
    const config = AppConfigSchema.parse(parse(raw));
    const defaultName = config.default;
    if (!defaultName) {
      throw new Error(`wolf.toml is missing the \`default\` field. Run \`${currentBinaryName()} init\` to repair your config.`);
    }
    if (!(await this.dirExists(defaultName))) {
      throw new Error(
        `Default profile directory 'profiles/${defaultName}/' not found. ` +
        `Either rename a profile folder back to '${defaultName}', or run ` +
        `\`${currentBinaryName()} profile use <name>\` to point wolf.toml at an existing profile.`,
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

  async getProfileToml(name: string): Promise<ProfileToml> {
    const cached = this.tomlCache.get(name);
    if (cached) return cached;

    const tomlPath = path.join(this.profileDir(name), 'profile.toml');
    let raw: string;
    try {
      raw = await fs.readFile(tomlPath, 'utf-8');
    } catch {
      // If the v1 profile.md still exists, surface a migration hint
      // rather than the bare ENOENT — most likely cause of this branch
      // is a v1 workspace that hasn't been migrated yet.
      const v1Md = path.join(this.profileDir(name), 'profile.md');
      try {
        await fs.access(v1Md);
        throw new Error(
          `Profile '${name}' is on the v1 schema (profile.md present, profile.toml missing). ` +
          `Run \`${currentBinaryName()} migrate\` to upgrade.`,
        );
      } catch (_) {
        // No v1 file either — workspace truly missing this profile's TOML.
        throw new Error(
          `profile.toml for profile '${name}' not found. Expected ${tomlPath} to exist. ` +
          `Run \`${currentBinaryName()} init\` to create it.`,
        );
      }
    }
    const parsed = parseProfileToml(raw);
    this.tomlCache.set(name, parsed);
    return parsed;
  }

  async getProfileMd(name: string): Promise<string> {
    const toml = await this.getProfileToml(name);
    return renderProfileMarkdown(toml);
  }

  async getResumePool(name: string): Promise<string> {
    const toml = await this.getProfileToml(name);
    return renderResumePoolMarkdown(toml);
  }

  async getStandardQuestions(name: string): Promise<string> {
    const toml = await this.getProfileToml(name);
    return renderStandardQuestionsMarkdown(toml);
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

  async getScoreMd(name: string): Promise<string> {
    const filePath = path.join(this.profileDir(name), 'score.md');
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      // Missing file is fine — score command treats it as no extra steer.
      return '';
    }
  }

  async writeScoreMd(name: string, content: string): Promise<void> {
    const dir = this.profileDir(name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'score.md'), content, 'utf-8');
  }

  async ensureScoreMd(name: string): Promise<void> {
    const filePath = path.join(this.profileDir(name), 'score.md');
    try {
      await fs.access(filePath);
      return; // already exists
    } catch {
      // create with placeholder header
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, SCORE_MD_PLACEHOLDER, 'utf-8');
  }
}

// Placeholder content written by `ensureScoreMd` and `wolf profile score init`.
// `> [!TODO]` blocks are stripped before the AI sees the file (project's
// stripComments convention), so this header is a self-documenting cue for
// the user without polluting the score prompt.
const SCORE_MD_PLACEHOLDER = `> [!TODO]
> score.md — profile-level scoring guide.
>
> Wolf merges this file into the score-system prompt on every \`wolf score\`
> invocation. Use it to give long-form steering the AI follows when picking
> a tier (skip / mass_apply / tailor / invest):
>
>   - "I really only want backend infra; PMs and frontend are skip."
>   - "These are the patterns that make me say invest vs tailor."
>   - "Salary below \$130k is tailor, never invest, regardless of stack."
>
> Short preferences (one or two lines) belong in
> profile.toml > [job_preferences].scoring_notes — that field is also fed to
> hunt and tailor. score.md is for longer narrative guidance the score
> command reads.
>
> The whole \`>\` block above is stripped before the file reaches the AI
> (see stripComments). Anything you write below the block is included
> verbatim. Leave the file empty below to run scoring without extra
> guidance.

`;

