export interface ProfileEntry {
  name: string;
  isDefault: boolean;
}

export type ProfileListResult =
  | { kind: 'no-profiles-dir' }
  | { kind: 'empty' }
  | { kind: 'ok'; profiles: ProfileEntry[] };

export interface ProfileCreateResult {
  name: string;
  from: string;
  targetDir: string;
}

export interface ProfileApplicationService {
  // Returns the profiles found under profiles/ and which one is the default.
  list(): Promise<ProfileListResult>;

  // Clones the source profile (default unless `from` is given) into a new
  // profiles/<name>/ directory.
  create(name: string, opts?: { from?: string }): Promise<ProfileCreateResult>;

  // Switches the default profile pointer in wolf.toml. Verifies the target
  // directory exists first.
  use(name: string): Promise<void>;

  // Removes a profile directory. Refuses to delete the current default and
  // requires opts.yes for safety.
  delete(name: string, opts?: { yes?: boolean }): Promise<string>;
}
