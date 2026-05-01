import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig, saveConfig, backupConfig } from '../../utils/config.js';
import { resolveWorkspaceDir, currentBinaryName, workspaceEnvVarName } from '../../utils/instance.js';
import { WorkspaceNotInitializedError } from '../../utils/errors/workspaceNotInitializedError.js';
import {
  PROFILE_FIELDS,
  PROFILE_FIELDS_BY_PATH,
  WOLF_BUILTIN_QUESTION_IDS,
  type FieldMeta,
} from '../../utils/profileFields.js';
import { parseProfileToml, getByPath } from '../../utils/profileToml.js';
import {
  PROFILE_PROMPTS_DIR,
  ensureProfilePromptPack,
  getProfilePromptPackStatus,
} from '../../utils/profilePromptPack.js';
import {
  setMultilineString,
  setMultilineStringInArrayMember,
  appendArrayMember,
  removeArrayMember,
} from '../../utils/tomlEdit.js';
import type {
  ProfileApplicationService,
  ProfileListResult,
  ProfileCreateResult,
  ProfileSetResult,
  ProfileAddEntryResult,
  ProfileFieldRow,
  ProfilePromptsResult,
  ProfilePromptsRepairResult,
} from '../profileApplicationService.js';

/** v2 profile sub-files cloned by `create()`. As of β only profile.toml. */
const PROFILE_FILES = ['profile.toml'] as const;

const ATTACHMENTS_DIR = 'attachments';

/** Filesystem-safe profile name: letters, digits, hyphen, underscore;
 *  must start with letter/digit so shells don't mistake it for a flag. */
function assertValidProfileName(name: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error(
      `Invalid profile name "${name}". Use letters, digits, hyphens, underscores; must start with a letter or digit.`,
    );
  }
}

function profileDir(name: string): string {
  return path.join(resolveWorkspaceDir(), 'profiles', name);
}

function profileTomlPath(name: string): string {
  return path.join(profileDir(name), 'profile.toml');
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/** Reads the active profile name from wolf.toml. Throws WorkspaceNotInitializedError
 *  with a clean banner if wolf.toml is missing or corrupt. */
async function resolveActiveProfileName(): Promise<string> {
  try {
    const config = await loadConfig();
    return config.default;
  } catch {
    throw new WorkspaceNotInitializedError(
      resolveWorkspaceDir(),
      workspaceEnvVarName(),
      `${currentBinaryName()} init`,
    );
  }
}

/** Slugify a free-form description into a URL-safe id. Falls back to UUID
 *  if the slug ends up empty (e.g. all special chars). */
function slugify(text: string): string {
  const cleaned = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .replace(/[^a-z0-9\s-]/g, ' ')   // non-alphanumeric → space
    .trim()
    .replace(/\s+/g, '-')             // spaces → dash
    .replace(/-+/g, '-')              // collapse repeated dashes
    .replace(/^-|-$/g, '');           // trim dashes
  if (cleaned.length === 0) {
    return 'item-' + randomUUID().slice(0, 8);
  }
  return cleaned;
}

/** Filesystem-backed `ProfileApplicationService`. Implements both legacy
 *  (list / create / use / delete) and v2 (show / get / set / add / remove
 *  / fields) operations against `profiles/<name>/profile.toml`. */
export class ProfileApplicationServiceImpl implements ProfileApplicationService {
  /** @inheritdoc */
  async list(): Promise<ProfileListResult> {
    const profilesDir = path.join(resolveWorkspaceDir(), 'profiles');
    let entries: string[] = [];
    try {
      entries = await fs.readdir(profilesDir);
    } catch {
      return { kind: 'no-profiles-dir' };
    }

    const defaultName = await loadConfig()
      .then(c => c.default)
      .catch(() => undefined);

    const dirs: string[] = [];
    for (const entry of entries) {
      if (await dirExists(path.join(profilesDir, entry))) dirs.push(entry);
    }

    if (dirs.length === 0) return { kind: 'empty' };

    const profiles = dirs.sort().map((name) => ({
      name,
      isDefault: name === defaultName,
    }));
    return { kind: 'ok', profiles };
  }

  /** @inheritdoc */
  async create(name: string, opts: { from?: string } = {}): Promise<ProfileCreateResult> {
    assertValidProfileName(name);

    const targetDir = profileDir(name);
    if (await dirExists(targetDir)) {
      throw new Error(`Profile "${name}" already exists at ${targetDir}`);
    }

    const srcName = opts.from ?? await loadConfig()
      .then(c => c.default)
      .catch(() => {
        throw new WorkspaceNotInitializedError(
          resolveWorkspaceDir(),
          workspaceEnvVarName(),
          `${currentBinaryName()} init`,
        );
      });

    const srcDir = profileDir(srcName);
    if (!(await dirExists(srcDir))) {
      throw new Error(`Source profile "${srcName}" not found at ${srcDir}`);
    }

    await fs.mkdir(targetDir, { recursive: true });

    // Each profile sub-file is independent — missing source files just skip
    // silently so a partial source profile still clones.
    for (const filename of PROFILE_FILES) {
      try {
        await fs.copyFile(path.join(srcDir, filename), path.join(targetDir, filename));
      } catch { /* source missing this file; skip */ }
    }

    try {
      await fs.cp(
        path.join(srcDir, ATTACHMENTS_DIR),
        path.join(targetDir, ATTACHMENTS_DIR),
        { recursive: true },
      );
    } catch { /* source had no attachments dir; skip */ }

    try {
      await fs.cp(
        path.join(srcDir, PROFILE_PROMPTS_DIR),
        path.join(targetDir, PROFILE_PROMPTS_DIR),
        { recursive: true },
      );
    } catch {
      // Older source profiles may not have prompts/ yet. Create the empty
      // strategy-pack skeleton so new profiles always have the modern shape.
      await ensureProfilePromptPack(targetDir);
    }

    return { name, from: srcName, targetDir };
  }

  /** @inheritdoc */
  async use(name: string): Promise<void> {
    const targetDir = profileDir(name);
    if (!(await dirExists(targetDir))) {
      throw new Error(`Profile "${name}" not found at ${targetDir}`);
    }

    const config = await loadConfig();
    const updated = { ...config, default: name };
    await backupConfig();
    await saveConfig(updated);
  }

  /** @inheritdoc */
  async delete(name: string, opts: { yes?: boolean } = {}): Promise<string> {
    const config = await loadConfig();
    if (name === config.default) {
      throw new Error(
        `Cannot delete the default profile "${name}". Switch defaults first: \`${currentBinaryName()} profile use <other-name>\``,
      );
    }

    const targetDir = profileDir(name);
    if (!(await dirExists(targetDir))) {
      throw new Error(`Profile "${name}" not found at ${targetDir}`);
    }

    if (!opts.yes) {
      throw new Error(
        `Refusing to delete ${targetDir} without --yes flag. ` +
        `Run: \`${currentBinaryName()} profile delete ${name} --yes\``,
      );
    }

    await fs.rm(targetDir, { recursive: true, force: true });
    return targetDir;
  }

  // ----- v2 operations --------------------------------------------------

  /** @inheritdoc */
  async show(name?: string): Promise<string> {
    const profileName = name ?? await resolveActiveProfileName();
    return readProfileToml(profileName);
  }

  /** @inheritdoc */
  async getField(dotPath: string, opts: { profileName?: string } = {}): Promise<string> {
    const profileName = opts.profileName ?? await resolveActiveProfileName();
    const content = await readProfileToml(profileName);
    const parsed = parseProfileToml(content);
    const value = getByPath(parsed, dotPath);
    if (value === undefined) {
      throw new Error(
        `Path '${dotPath}' not found in profile '${profileName}'. ` +
        `Run \`${currentBinaryName()} profile fields\` to see available paths.`,
      );
    }
    return typeof value === 'string' ? value : String(value);
  }

  /** @inheritdoc */
  async setField(
    dotPath: string,
    value: string,
    opts: { profileName?: string } = {},
  ): Promise<ProfileSetResult> {
    const profileName = opts.profileName ?? await resolveActiveProfileName();
    const tomlPath = profileTomlPath(profileName);

    // Validate the path against PROFILE_FIELDS or array-member shape.
    const parts = dotPath.split('.');
    if (parts.length === 2) {
      // Top-level: <table>.<field>. Must be in PROFILE_FIELDS to allow.
      if (!PROFILE_FIELDS_BY_PATH.has(dotPath)) {
        throw new Error(
          `Unknown profile path '${dotPath}'. ` +
          `Run \`${currentBinaryName()} profile fields\` to see available paths.`,
        );
      }
    } else if (parts.length === 3) {
      // Array-of-table: <type>.<id>.<field>. Validate type + builtin protection.
      const [arrayName, id, field] = parts;
      const ALLOWED_ARRAYS = new Set(['experience', 'project', 'education', 'question']);
      if (!ALLOWED_ARRAYS.has(arrayName)) {
        throw new Error(
          `Unknown array '${arrayName}'. Allowed: experience / project / education / question.`,
        );
      }
      // Builtin question protection.
      if (arrayName === 'question' && WOLF_BUILTIN_QUESTION_IDS.has(id)) {
        if (field === 'prompt') {
          throw new Error(
            `Cannot change prompt of wolf-builtin question '${id}'. ` +
            `Builtins are read-only on this field.`,
          );
        }
        if (field === 'required') {
          throw new Error(
            `Cannot change required-flag of wolf-builtin question '${id}'.`,
          );
        }
        // answer / subnote are fine to edit on builtins.
      }
    } else {
      throw new Error(
        `Invalid path '${dotPath}'. Expected '<table>.<field>' or '<type>.<id>.<field>'.`,
      );
    }

    // Read current value for the diff-y result. parseProfileToml is
    // tolerant; if the file is malformed it'll throw with a useful error.
    const before = await readProfileToml(profileName);
    let oldValueRaw: string | boolean | number | undefined;
    try {
      const parsed = parseProfileToml(before);
      oldValueRaw = getByPath(parsed, dotPath);
    } catch {
      oldValueRaw = undefined;
    }
    const oldValue = oldValueRaw === undefined ? '' : String(oldValueRaw);

    // Apply the surgical edit. setMultilineString variants reject `"""`
    // input automatically — caller must use --from-file for those values.
    let after: string;
    if (parts.length === 2) {
      const [table, field] = parts;
      after = setMultilineString(before, table, field, value);
    } else {
      const [arrayName, id, field] = parts;
      after = setMultilineStringInArrayMember(before, arrayName, id, field, value);
    }
    await fs.writeFile(tomlPath, after, 'utf-8');

    return { path: dotPath, oldValue: oldValue.trim(), newValue: value.trim() };
  }

  /** @inheritdoc */
  async addEntry(
    arrayName: 'experience' | 'project' | 'education',
    opts: { id?: string; slugFrom?: string; profileName?: string } = {},
  ): Promise<ProfileAddEntryResult> {
    const profileName = opts.profileName ?? await resolveActiveProfileName();
    const tomlPath = profileTomlPath(profileName);
    const before = await readProfileToml(profileName);

    // Decide the id. Priority: explicit --id > --slug-from > UUID fallback.
    let proposedId: string;
    if (opts.id) {
      proposedId = opts.id;
    } else if (opts.slugFrom) {
      proposedId = slugify(opts.slugFrom);
    } else {
      proposedId = `${arrayName}-${randomUUID().slice(0, 8)}`;
    }

    // Validate id shape (slug-style; agents shouldn't pass spaces / quotes).
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(proposedId)) {
      throw new Error(
        `Invalid id "${proposedId}". Use letters, digits, hyphens, underscores; must start with letter/digit.`,
      );
    }

    // De-dupe against existing entries: parse, check; if collision append
    // -2 / -3 / etc. Cap retries so a pathological case fails loud.
    const parsed = parseProfileToml(before);
    const existingIds = new Set(
      (parsed[arrayName] as Array<{ id: string }>).map((e) => e.id),
    );
    let id = proposedId;
    let attempt = 2;
    while (existingIds.has(id)) {
      id = `${proposedId}-${attempt}`;
      attempt++;
      if (attempt > 100) {
        throw new Error(`Could not generate a unique id from "${proposedId}".`);
      }
    }

    // Build the empty block. Each array type has its own field set; we
    // enumerate them here so the appended block matches the schema shape.
    const block = buildEmptyArrayBlock(arrayName, id);
    const after = appendArrayMember(before, block);
    await fs.writeFile(tomlPath, after, 'utf-8');

    return { arrayName, id };
  }

  /** @inheritdoc */
  async addQuestion(opts: {
    prompt: string;
    answer?: string;
    id?: string;
    profileName?: string;
  }): Promise<ProfileAddEntryResult> {
    if (!opts.prompt || opts.prompt.trim().length === 0) {
      throw new Error('--prompt is required and must be non-empty.');
    }
    const profileName = opts.profileName ?? await resolveActiveProfileName();
    const tomlPath = profileTomlPath(profileName);
    const before = await readProfileToml(profileName);

    // Id resolution: explicit --id > slugify(prompt) > UUID fallback.
    let proposedId = opts.id ?? slugify(opts.prompt);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(proposedId)) {
      throw new Error(
        `Invalid id "${proposedId}". Use letters, digits, hyphens, underscores; must start with letter/digit.`,
      );
    }

    // De-dupe against existing entries (including any wolf-builtin id —
    // we don't overwrite a builtin if user picks the same slug).
    const parsed = parseProfileToml(before);
    const existingIds = new Set(parsed.question.map((s) => s.id));
    let id = proposedId;
    let attempt = 2;
    while (existingIds.has(id)) {
      id = `${proposedId}-${attempt}`;
      attempt++;
      if (attempt > 100) {
        throw new Error(`Could not generate a unique id from "${proposedId}".`);
      }
    }

    // Build the [[question]] block with prompt + (optional) answer.
    const block = buildQuestionBlock(id, opts.prompt, opts.answer ?? '');
    const after = appendArrayMember(before, block);
    await fs.writeFile(tomlPath, after, 'utf-8');

    return { arrayName: 'question', id };
  }

  /** @inheritdoc */
  async removeEntry(
    arrayName: 'experience' | 'project' | 'education' | 'question',
    id: string,
    opts: { yes?: boolean; profileName?: string } = {},
  ): Promise<void> {
    if (arrayName === 'question' && WOLF_BUILTIN_QUESTION_IDS.has(id)) {
      throw new Error(
        `Cannot remove wolf-builtin question '${id}'. ` +
        `Clear its answer to "skip" instead: \`${currentBinaryName()} profile set question.${id}.answer ""\``,
      );
    }
    if (!opts.yes) {
      throw new Error(
        `Refusing to remove ${arrayName}.${id} without --yes flag. ` +
        `Run: \`${currentBinaryName()} profile remove ${arrayName} ${id} --yes\``,
      );
    }

    const profileName = opts.profileName ?? await resolveActiveProfileName();
    const tomlPath = profileTomlPath(profileName);
    const before = await readProfileToml(profileName);
    const after = removeArrayMember(before, arrayName, id);
    await fs.writeFile(tomlPath, after, 'utf-8');
  }

  /** @inheritdoc */
  async fields(opts: { requiredOnly?: boolean; path?: string } = {}): Promise<ProfileFieldRow[]> {
    let rows: ReadonlyArray<FieldMeta> = PROFILE_FIELDS;
    if (opts.path) {
      const meta = PROFILE_FIELDS_BY_PATH.get(opts.path);
      rows = meta ? [meta] : [];
    }
    if (opts.requiredOnly) {
      rows = rows.filter((f) => f.required);
    }
    return rows.map((f) => ({ ...f }));
  }

  /** @inheritdoc */
  async prompts(): Promise<ProfilePromptsResult> {
    const profileName = await resolveActiveProfileName();
    const status = await getProfilePromptPackStatus(profileDir(profileName));
    return {
      profileName,
      dir: status.dir,
      files: status.files.map((f) => ({ ...f })),
    };
  }

  /** @inheritdoc */
  async repairPrompts(): Promise<ProfilePromptsRepairResult> {
    const profileName = await resolveActiveProfileName();
    const result = await ensureProfilePromptPack(profileDir(profileName));
    return {
      profileName,
      dir: result.dir,
      created: [...result.created],
      preserved: [...result.preserved],
    };
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Reads `profiles/<name>/profile.toml` content as a string. Throws if
 *  missing — message points at `wolf init` or `wolf migrate` based on
 *  whether v1 .md files are present. */
async function readProfileToml(name: string): Promise<string> {
  const tomlPath = profileTomlPath(name);
  try {
    return await fs.readFile(tomlPath, 'utf-8');
  } catch {
    // Distinguish "v1 workspace not migrated" vs "profile doesn't exist".
    const v1Md = path.join(profileDir(name), 'profile.md');
    try {
      await fs.access(v1Md);
      throw new Error(
        `Profile '${name}' is on the v1 schema (profile.md present, profile.toml missing). ` +
        `Run \`${currentBinaryName()} migrate\` to upgrade.`,
      );
    } catch {
      throw new Error(
        `profile.toml for profile '${name}' not found. Expected ${tomlPath} to exist. ` +
        `Run \`${currentBinaryName()} init\` to create it.`,
      );
    }
  }
}

/** Returns the empty `[[<arrayName>]]` block text (with the supplied id +
 *  every other field as empty multiline string). Schema-aligned with
 *  ProfileTomlSchema's array-entry definitions. */
function buildEmptyArrayBlock(arrayName: 'experience' | 'project' | 'education', id: string): string {
  const FIELDS_BY_TYPE: Record<typeof arrayName, string[]> = {
    experience: ['job_title', 'company', 'start', 'end', 'location', 'bullets', 'subnote'],
    project:    ['name', 'year', 'tech_stack', 'bullets', 'subnote'],
    education:  ['degree', 'school', 'start', 'end', 'gpa', 'relevant_coursework', 'subnote'],
  };
  const lines: string[] = [`[[${arrayName}]]`, `id = "${id}"`];
  for (const f of FIELDS_BY_TYPE[arrayName]) {
    lines.push(`${f} = """`, '', '"""');
  }
  return lines.join('\n');
}

/** Returns a `[[question]]` block for a user-custom question (required = false).
 *  prompt is the question text; answer may be pre-filled or empty.
 *  Multiline triple-quote shape matches what surgical edits expect for
 *  later updates. */
function buildQuestionBlock(id: string, prompt: string, answer: string): string {
  // Reject `"""` in either value — would break TOML termination. Same
  // contract as setMultilineString in tomlEdit.
  if (prompt.includes('"""') || answer.includes('"""')) {
    throw new Error(
      `Story prompt or answer contains triple-quote ("""), which would ` +
      `break TOML multiline-string termination. Pass via --from-file <path> instead.`,
    );
  }
  return [
    '[[question]]',
    `id = "${id}"`,
    'prompt = """',
    prompt,
    '"""',
    'required = false',
    'answer = """',
    answer,
    '"""',
    'subnote = """',
    '',
    '"""',
  ].join('\n');
}
