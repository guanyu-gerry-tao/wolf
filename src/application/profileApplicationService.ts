/**
 * One row of the `wolf profile list` output.
 */
export interface ProfileEntry {
  name: string;
  isDefault: boolean;
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
}
