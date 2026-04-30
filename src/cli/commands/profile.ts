import fs from 'node:fs/promises';
import { createAppContext, type AppContext } from '../../runtime/appContext.js';
import { currentBinaryName } from '../../utils/instance.js';

/**
 * Lists every profile directory under profiles/, marking the default with `*`.
 */
export async function profileList(ctx: AppContext = createAppContext()): Promise<void> {
  const result = await ctx.profileApp.list();
  if (result.kind === 'no-profiles-dir') {
    console.log(`No profiles directory. Run \`${currentBinaryName()} init\` first.`);
    return;
  }
  if (result.kind === 'empty') {
    console.log(`No profiles. Run \`${currentBinaryName()} init\` or \`${currentBinaryName()} profile create <name>\`.`);
    return;
  }
  for (const { name, isDefault } of result.profiles) {
    const marker = isDefault ? '*' : ' ';
    console.log(`${marker} ${name}`);
  }
}

/**
 * Creates a new profile under profiles/<name>/, cloning from the source profile.
 */
export async function profileCreate(
  name: string,
  opts: { from?: string } = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  const r = await ctx.profileApp.create(name, opts);
  console.log(`Created profile: ${r.name} (cloned from "${r.from}")`);
}

/**
 * Switches the default profile by updating `wolf.toml.default`.
 */
export async function profileUse(name: string, ctx: AppContext = createAppContext()): Promise<void> {
  await ctx.profileApp.use(name);
  console.log(`Default profile set to: ${name}`);
}

/**
 * Deletes a profile directory. Refuses to delete the current default.
 */
export async function profileDelete(
  name: string,
  opts: { yes?: boolean } = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  await ctx.profileApp.delete(name, opts);
  console.log(`Deleted profile: ${name}`);
}

/**
 * Prints the active profile.toml verbatim. Debug / human-inspect path.
 * Different from `wolf context --for=search` which renders an AI-prompt-
 * friendly subset.
 */
export async function profileShow(ctx: AppContext = createAppContext()): Promise<void> {
  const text = await ctx.profileApp.show();
  process.stdout.write(text.endsWith('\n') ? text : text + '\n');
}

/**
 * Reads a single field by dot-path. Output is JUST the value (trimmed) so
 * it can be piped: `wolf profile get contact.email | mail-helper`.
 */
export async function profileGet(
  dotPath: string,
  ctx: AppContext = createAppContext(),
): Promise<void> {
  const value = await ctx.profileApp.getField(dotPath);
  // value is the raw multiline string per smol-toml — print trimmed for
  // CLI ergonomics. Tests / scripts that need verbatim newlines can call
  // the application service directly.
  process.stdout.write(value.trim() + '\n');
}

/**
 * Writes a field via surgical TOML edit (preserves comments / formatting).
 *
 * `--from-file <path>` reads the value from a file instead of the CLI arg —
 * use this for long prose, multi-line content, or values that contain
 * triple-quote / shell-quoting hazards.
 */
export async function profileSet(
  dotPath: string,
  rawValue: string | undefined,
  opts: { fromFile?: string } = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  let value: string;
  if (opts.fromFile) {
    value = await fs.readFile(opts.fromFile, 'utf-8');
    // Strip trailing newline that `cat <file> | wolf profile set` would
    // typically introduce — users expect "the file's content" verbatim,
    // not a phantom trailing newline.
    value = value.replace(/\n$/, '');
  } else if (rawValue !== undefined) {
    value = rawValue;
  } else {
    throw new Error(
      `\`${currentBinaryName()} profile set\` requires either a value argument or --from-file <path>.`,
    );
  }
  const result = await ctx.profileApp.setField(dotPath, value);
  console.log(`set ${result.path}`);
  if (result.oldValue.length > 0 && result.oldValue !== result.newValue) {
    console.log(`  was: ${truncatePreview(result.oldValue)}`);
  }
  console.log(`  now: ${truncatePreview(result.newValue)}`);
}

function truncatePreview(s: string): string {
  const oneLine = s.replace(/\n/g, ' ⏎ ');
  return oneLine.length > 80 ? oneLine.slice(0, 77) + '...' : oneLine;
}

/**
 * Adds a new array-of-table entry. `--id <id>` to specify; `--slug-from
 * "<text>"` for AI agents that want wolf to slugify a natural description;
 * neither → wolf falls back to a UUID-style slug.
 */
export async function profileAdd(
  arrayName: 'experience' | 'project' | 'education',
  opts: { id?: string; slugFrom?: string } = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  const r = await ctx.profileApp.addEntry(arrayName, opts);
  console.log(`Added ${r.arrayName}.${r.id}`);
  console.log(`  fill fields with \`${currentBinaryName()} profile set ${r.arrayName}.${r.id}.<field> <value>\``);
}

/**
 * Removes an array-of-table entry by id. `--yes` is required (typo guard).
 * Builtin stories cannot be removed (clear `star_story` instead).
 */
export async function profileRemove(
  arrayName: 'experience' | 'project' | 'education' | 'story',
  id: string,
  opts: { yes?: boolean } = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  await ctx.profileApp.removeEntry(arrayName, id, opts);
  console.log(`Removed ${arrayName}.${id}`);
}

/**
 * Prints the field reference for the active profile. Default format is
 * markdown grouped by REQUIRED / OPTIONAL; `--required` filters; `--json`
 * dumps machine-readable rows for AI / MCP consumers; an explicit dot-path
 * argument prints just that one field's detail.
 */
export async function profileFields(
  pathArg: string | undefined,
  opts: { required?: boolean; json?: boolean } = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  const rows = await ctx.profileApp.fields({ requiredOnly: opts.required, path: pathArg });
  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (pathArg) {
    if (rows.length === 0) {
      throw new Error(`No field with path '${pathArg}'. Run \`${currentBinaryName()} profile fields\` to list all paths.`);
    }
    const f = rows[0];
    console.log(f.path);
    console.log(`  ${f.required ? 'REQUIRED' : 'OPTIONAL'}  type=${f.type}`);
    if (f.help) console.log(`  ${f.help}`);
    return;
  }
  // Group: REQUIRED first, then OPTIONAL. Within each, order matches
  // PROFILE_FIELDS' declaration so users see the same shape as the file.
  const required = rows.filter((r) => r.required);
  const optional = rows.filter((r) => !r.required);
  if (required.length > 0) {
    console.log('REQUIRED:');
    for (const f of required) {
      console.log(`  ${f.path.padEnd(50)} ${f.help}`);
    }
    console.log('');
  }
  if (optional.length > 0 && !opts.required) {
    console.log('OPTIONAL:');
    for (const f of optional) {
      console.log(`  ${f.path.padEnd(50)} ${f.help}`);
    }
  }
}
