/**
 * One row of the `wolf profile list` output.
 */
export interface ProfileEntry {
  name: string;
  isDefault: boolean;
}

/** Result of `setField` — concise enough that callers can render it directly. */
export interface ProfileSetResult {
  path: string;
  oldValue: string;
  newValue: string;
}

/** Result of `addEntry` / `addQuestion`. */
export interface ProfileAddEntryResult {
  arrayName: 'experience' | 'project' | 'education' | 'question';
  id: string;
}

/** What `wolf profile fields` returns: structured so the CLI can render
 *  either markdown (default) or JSON (--json) without reparsing strings. */
export interface ProfileFieldRow {
  path: string;
  required: boolean;
  type: 'multilineString' | 'scalar';
  help: string;
}

/** One file in `profiles/<name>/prompts/`. Strategy files may be empty;
 *  empty means "use wolf defaults". */
export interface ProfilePromptFileRow {
  filename: string;
  path: string;
  exists: boolean;
  empty: boolean;
  kind: 'readme' | 'strategy';
}

/** Status for the active profile's prompt pack. */
export interface ProfilePromptsResult {
  profileName: string;
  dir: string;
  files: ProfilePromptFileRow[];
}

/** Result of repairing the prompt pack skeleton. Existing files are never
 *  overwritten; missing files are created. */
export interface ProfilePromptsRepairResult {
  profileName: string;
  dir: string;
  created: string[];
  preserved: string[];
}

/**
 * `list()` result — distinguishes "no profiles dir at all" (run `wolf init`),
 * "dir exists but empty" (run `wolf profile create`), and the populated case.
 * The CLI wrapper picks the right user-facing message off `kind`.
 */
export type ProfileListResult =
  | { kind: 'no-profiles-dir' }
  | { kind: 'empty' }
  | { kind: 'ok'; profiles: ProfileEntry[] };

/**
 * `create()` result — the new profile name, the source it cloned from
 * (default unless `--from` was given), and the absolute target dir for
 * the success message.
 */
export interface ProfileCreateResult {
  name: string;
  from: string;
  targetDir: string;
}

/**
 * Use case for `wolf profile list / create / use / delete` — manages the
 * `profiles/<name>/` directories under the workspace and the `default`
 * pointer in `wolf.toml`.
 */
export interface ProfileApplicationService {
  /**
   * Lists profile directories with the default flagged. Returns a tagged
   * union so the CLI can render different messages without re-checking
   * filesystem state.
   */
  list(): Promise<ProfileListResult>;

  /**
   * Clones the source profile (the default unless `opts.from` is given)
   * into a new `profiles/<name>/`. Validates the name (filesystem-safe),
   * refuses to overwrite an existing directory, copies all four MD files
   * + `attachments/`.
   *
   * @throws If the name is invalid, the target exists, or the source is missing.
   */
  create(name: string, opts?: { from?: string }): Promise<ProfileCreateResult>;

  /**
   * Switches the default profile by updating `wolf.toml.default`. Verifies
   * the target directory exists first — refuses to set the pointer to a
   * profile that won't resolve.
   */
  use(name: string): Promise<void>;

  /**
   * Removes a profile directory. Refuses to delete the current default
   * (switch first via `use`); requires `opts.yes=true` for safety; returns
   * the deleted directory path for the success message.
   */
  delete(name: string, opts?: { yes?: boolean }): Promise<string>;

  /**
   * Returns the raw text of `profiles/<name>/profile.toml` (or the active
   * profile when `name` is omitted). The CLI's `wolf profile show` cats
   * this verbatim — comments / formatting / everything intact.
   */
  show(name?: string): Promise<string>;

  /**
   * Reads a single field by dot-path. Returns the value as a string for
   * the CLI to print. Throws if the path doesn't resolve.
   *
   * Path shapes accepted (same as `wolf profile set`):
   *   - `<table>.<field>`           e.g. `contact.email`
   *   - `<type>.<id>.<field>`        e.g. `experience.amazon-2024.bullets`
   */
  getField(path: string, opts?: { profileName?: string }): Promise<string>;

  /**
   * Surgically writes a new value at the given dot-path, preserving
   * comments and other fields in profile.toml. Returns oldValue / newValue
   * so the CLI can render a diff-y "set X to Y" line.
   *
   * @throws if the path can't be resolved, the value contains `"""`
   *   (would break TOML termination — use `--from-file` instead), or the
   *   field is not user-writable (story.<id>.prompt on a wolf-builtin etc).
   */
  setField(path: string, value: string, opts?: { profileName?: string }): Promise<ProfileSetResult>;

  /**
   * Appends a new array-of-table entry (`[[experience]]` / `[[project]]` /
   * `[[education]]`) with a stable id. wolf generates the id from
   * `opts.slugFrom` (slugified) or uses `opts.id` verbatim, falling back
   * to a UUID-style slug if neither is given. Returns the resolved id so
   * the CLI can echo it back to the agent.
   */
  addEntry(
    arrayName: 'experience' | 'project' | 'education',
    opts?: { id?: string; slugFrom?: string; profileName?: string },
  ): Promise<ProfileAddEntryResult>;

  /**
   * Appends a user-custom `[[question]]` entry. Different signature from
   * `addEntry` because stories carry the question text in a `prompt`
   * field rather than deriving id-only from a slug.
   *
   * - `opts.prompt` (REQUIRED): the question text. Becomes both the
   *   `prompt` field AND the source of the slugified id (unless
   *   `opts.id` is given explicitly).
   * - `opts.answer` (OPTIONAL): pre-fills `answer`. If omitted,
   *   the user can fill it later via `wolf profile set
   *   question.<id>.answer <text>`.
   * - `opts.id` (OPTIONAL): override the generated slug.
   *
   * Custom stories always get `required = false` (only wolf-builtin
   * stories carry `required = true`). The id can collide with a builtin
   * id; in that case wolf appends `-2` / `-3` rather than overwriting.
   */
  addQuestion(opts: {
    prompt: string;
    answer?: string;
    id?: string;
    profileName?: string;
  }): Promise<ProfileAddEntryResult>;

  /**
   * Removes a `[[<arrayName>]]` entry by id. Refuses to delete a
   * wolf-builtin story (clear `answer` to skip instead). Requires
   * `opts.yes` so a typo in id can't silently drop the wrong entry.
   */
  removeEntry(
    arrayName: 'experience' | 'project' | 'education' | 'question',
    id: string,
    opts?: { yes?: boolean; profileName?: string },
  ): Promise<void>;

  /**
   * Returns the field reference for `wolf profile fields`. Filters to
   * `required: true` when `opts.requiredOnly` is set; looks up a single
   * entry by `opts.path` for `wolf profile fields <path>`.
   */
  fields(opts?: { requiredOnly?: boolean; path?: string }): Promise<ProfileFieldRow[]>;

  /**
   * Reports the prompt-pack skeleton for the active profile. This is a
   * strategy-only customization surface; runtime protocol prompts stay bundled.
   */
  prompts(): Promise<ProfilePromptsResult>;

  /**
   * Creates any missing prompt-pack files for the active profile without
   * overwriting user-edited strategy files.
   */
  repairPrompts(): Promise<ProfilePromptsRepairResult>;

  /**
   * Reports the absolute path of `profiles/<active>/score.md` (the
   * profile-level scoring guide). The CLI's `wolf profile score show / edit`
   * subcommands use this to cat or open the file.
   */
  scoreMdPath(): Promise<{ profileName: string; path: string }>;

  /**
   * Returns the raw contents of `profiles/<active>/score.md`. Empty string
   * if the file is missing — `wolf profile score show` prints nothing in
   * that case so AI orchestrators can detect the empty-guide state.
   */
  scoreMdContent(): Promise<{ profileName: string; path: string; content: string }>;

  /**
   * Idempotently creates `profiles/<active>/score.md` with the placeholder
   * `> [!TODO]` header if absent. Returns whether a file was created and
   * the absolute path so the CLI can print a confirming message.
   */
  scoreMdInit(): Promise<{ profileName: string; path: string; created: boolean }>;
}
