import fs from 'node:fs/promises';
import { createAppContext, type AppContext } from '../../../runtime/appContext.js';
import { currentBinaryName } from '../../../utils/instance.js';

/**
 * Prints every column of a job row plus the JD prose. JSON output for
 * AI / MCP consumers; default human-readable layout otherwise.
 */
export async function jobShow(
  id: string,
  opts: { json?: boolean } = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  const result = await ctx.jobApp.show(id);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`# ${result.companyName} — ${(result.fields.title as string) ?? ''}`);
  console.log(`id: ${result.fields.id}`);
  console.log('');
  // Print every flat column, skipping description_md (rendered separately).
  for (const [k, v] of Object.entries(result.fields)) {
    if (k === 'id' || k === 'companyId') continue;
    const printed = v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
    console.log(`${k}: ${printed}`);
  }
  console.log(`companyId: ${result.fields.companyId}`);
  if (result.descriptionMd.trim().length > 0) {
    console.log('');
    console.log('--- description_md ---');
    console.log(result.descriptionMd);
  }
}

/**
 * Reads one field by name. Pipe-friendly: prints just the value (trimmed
 * for scalars; verbatim for `description_md`).
 */
export async function jobGet(
  id: string,
  field: string,
  ctx: AppContext = createAppContext(),
): Promise<void> {
  const v = await ctx.jobApp.getField(id, field);
  process.stdout.write(v.endsWith('\n') ? v : v + '\n');
}

/**
 * Writes one field by name. `--from-file <path>` reads the value from a
 * file (use for long prose like `description_md` or values containing
 * shell-quoting hazards).
 */
export async function jobSet(
  id: string,
  field: string,
  rawValue: string | undefined,
  opts: { fromFile?: string } = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  let value: string;
  if (opts.fromFile) {
    value = await fs.readFile(opts.fromFile, 'utf-8');
    // Strip the trailing newline that `cat <file> | wolf job set` typically
    // introduces — users expect "the file's content" verbatim.
    value = value.replace(/\n$/, '');
  } else if (rawValue !== undefined) {
    value = rawValue;
  } else {
    throw new Error(
      `\`${currentBinaryName()} job set\` requires either a value argument or --from-file <path>.`,
    );
  }

  const r = await ctx.jobApp.setField(id, field, value);
  console.log(`set ${r.field}`);
  if (r.oldValue.length > 0 && r.oldValue !== r.newValue) {
    console.log(`  was: ${truncatePreview(r.oldValue)}`);
  }
  console.log(`  now: ${truncatePreview(r.newValue)}`);
}

/**
 * Prints the field reference. Default = markdown layout grouped by
 * REQUIRED / OPTIONAL; `--required` filters; `--json` dumps machine-
 * readable rows; an explicit field name argument prints just that one.
 */
export async function jobFields(
  nameArg: string | undefined,
  opts: { required?: boolean; json?: boolean } = {},
  ctx: AppContext = createAppContext(),
): Promise<void> {
  const rows = ctx.jobApp.fields({ requiredOnly: opts.required, name: nameArg });
  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (nameArg) {
    if (rows.length === 0) {
      throw new Error(
        `No field named '${nameArg}'. Run \`${currentBinaryName()} job fields\` to list all names.`,
      );
    }
    const f = rows[0];
    console.log(f.name);
    console.log(`  ${f.required ? 'REQUIRED' : 'OPTIONAL'}  type=${f.type}`);
    if (f.enumValues) console.log(`  values: ${f.enumValues.join(', ')}`);
    if (f.help) console.log(`  ${f.help}`);
    return;
  }
  const required = rows.filter((r) => r.required);
  const optional = rows.filter((r) => !r.required);
  if (required.length > 0) {
    console.log('REQUIRED:');
    for (const f of required) {
      console.log(`  ${f.name.padEnd(30)} ${f.help}`);
    }
    console.log('');
  }
  if (optional.length > 0 && !opts.required) {
    console.log('OPTIONAL:');
    for (const f of optional) {
      console.log(`  ${f.name.padEnd(30)} ${f.help}`);
    }
  }
}

function truncatePreview(s: string): string {
  const oneLine = s.replace(/\n/g, ' ⏎ ');
  return oneLine.length > 80 ? oneLine.slice(0, 77) + '...' : oneLine;
}
