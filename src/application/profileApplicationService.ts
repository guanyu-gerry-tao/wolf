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

/** Result of `addEntry`. */
export interface ProfileAddEntryResult {
  arrayName: 'experience' | 'project' | 'education';
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
   *
   * Stories are NOT addable via this method in β — the 17 builtins are
   * seeded at init time and `wolf profile add story --prompt` is a
   * future-phase command.
   */
  addEntry(
    arrayName: 'experience' | 'project' | 'education',
    opts?: { id?: string; slugFrom?: string; profileName?: string },
  ): Promise<ProfileAddEntryResult>;

  /**
   * Removes a `[[<arrayName>]]` entry by id. Refuses to delete a
   * wolf-builtin story (clear `star_story` to skip instead). Requires
   * `opts.yes` so a typo in id can't silently drop the wrong entry.
   */
  removeEntry(
    arrayName: 'experience' | 'project' | 'education' | 'story',
    id: string,
    opts?: { yes?: boolean; profileName?: string },
  ): Promise<void>;

  /**
   * Returns the field reference for `wolf profile fields`. Filters to
   * `required: true` when `opts.requiredOnly` is set; looks up a single
   * entry by `opts.path` for `wolf profile fields <path>`.
   */
  fields(opts?: { requiredOnly?: boolean; path?: string }): Promise<ProfileFieldRow[]>;
}
