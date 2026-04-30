import { PROFILE_FIELDS, WOLF_BUILTIN_QUESTIONS, type FieldMeta } from './profileFields.js';

/**
 * Generates the bundled `profile.toml` template string from PROFILE_FIELDS
 * + WOLF_BUILTIN_QUESTIONS + a small hardcoded section table.
 *
 * # Why generate at runtime instead of shipping a static file
 *
 * Single source of truth. Editing one PROFILE_FIELDS entry rebuilds the
 * template, the `wolf profile fields` listing, and doctor's required-set
 * in lockstep. The previous setup (hand-written .toml + hand-maintained
 * PROFILE_FIELDS + alignment test) caught drift in CI but still required
 * touching two files for every field change.
 *
 * # Section structure (hardcoded, not derived)
 *
 * Per-field `comment` is single-line and lives on the field. Per-section
 * dividers and large prose blocks (the file header, demographics EEO
 * preamble, experience / project / education examples, question prelude)
 * are deliberately hardcoded here — they're not field-shaped, and putting
 * them on PROFILE_FIELDS would muddy the spec.
 *
 * # Output guarantees (covered by alignment test)
 *
 * - Parses cleanly via `parseProfileToml`.
 * - Every PROFILE_FIELDS path appears exactly once at `<table>.<field>`.
 * - Every WOLF_BUILTIN_QUESTIONS entry produces a `[[question]]` block.
 * - `schemaVersion = 2` line is present.
 */

// ---------------------------------------------------------------------------
// Section metadata: title + optional preamble per top-level table.
// Order here = output order. Tables not listed are appended at the end
// alphabetically (defensive — never expected to fire if the table is in
// PROFILE_FIELDS, the alignment test would catch it).
// ---------------------------------------------------------------------------

interface SectionMeta {
  table: string;
  title: string;
  /** Extra prose printed after the title divider, before `[table]`. Each
   *  line is prefixed with `# `. Empty = no preamble. */
  preamble?: string;
}

const SECTIONS: ReadonlyArray<SectionMeta> = [
  { table: 'resume',          title: 'Resume layout' },
  { table: 'identity',        title: 'Identity' },
  { table: 'contact',         title: 'Contact' },
  { table: 'address',         title: 'Address' },
  { table: 'links',           title: 'Links' },
  { table: 'job_preferences', title: 'Job preferences' },
  {
    table: 'demographics',
    title: 'Demographics — OPTIONAL EEO; all voluntary by US law.',
    preamble:
      'Skip = leave blank. Decline = write "Decline to answer" or similar\n' +
      'literal — wolf fill writes that exact text into ATS forms.',
  },
  { table: 'clearance',    title: 'Clearance' },
  { table: 'documents',    title: 'Documents — file names inside attachments/' },
  { table: 'skills',       title: 'Skills' },
];

/** Tables that are emitted together under one "Optional resume sections" divider.
 *  Order here = output order. */
const OPTIONAL_RESUME_TABLES = [
  'awards',
  'publications',
  'patents',
  'hackathons',
  'open_source',
  'certifications',
  'languages_spoken',
  'volunteer',
  'interests',
  'speaking',
] as const;

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

/** Emit a `# === Title === ...` divider block (no leading/trailing newline). */
function renderSectionDivider(title: string, preamble?: string): string {
  const bar = '# ' + '='.repeat(75);
  const lines = [bar, `# ${title}`, bar];
  if (preamble && preamble.trim().length > 0) {
    lines.push('#');
    for (const line of preamble.split('\n')) {
      lines.push(`# ${line}`);
    }
  }
  return lines.join('\n');
}

/** Emit one field: optional `# comment` line, then `key = """\n<default>\n"""`. */
function renderField(meta: FieldMeta): string {
  const fieldName = meta.path.split('.').slice(1).join('.');
  const lines: string[] = [];
  if (meta.comment && meta.comment.trim().length > 0) {
    lines.push(`# ${meta.comment.trim()}`);
  }
  const value = meta.defaultValue ?? '';
  lines.push(`${fieldName} = """`);
  lines.push(value);
  lines.push('"""');
  return lines.join('\n');
}

/** Emit `[table]` + every PROFILE_FIELDS entry whose first dot-segment is `table`. */
function renderTable(table: string): string {
  const fields = PROFILE_FIELDS.filter((f) => f.path.startsWith(`${table}.`));
  const lines: string[] = [`[${table}]`, ''];
  for (const f of fields) {
    lines.push(renderField(f));
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

/** Emit one [[question]] block for a wolf-builtin prompt. Seeds `answer`
 *  with `defaultAnswer` if any (for short verbatim Q&A absorbed from the
 *  former [form_answers] table), otherwise blank. */
function renderBuiltinQuestionBlock(q: { id: string; prompt: string; required: boolean; defaultAnswer?: string }): string {
  return [
    '[[question]]',
    `id = "${q.id}"`,
    'prompt = """',
    q.prompt,
    '"""',
    `required = ${q.required ? 'true' : 'false'}`,
    'answer = """',
    q.defaultAnswer ?? '',
    '"""',
    'subnote = """',
    '',
    '"""',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Template assembly
// ---------------------------------------------------------------------------

const FILE_HEADER = `schemaVersion = 2

# ###########################################################################
# Profile — your wolf workspace identity & preferences
# ###########################################################################
#
# Three answering modes per field:
#   - You have an answer       → write between the triple quotes below.
#   - You don't care / skip    → leave blank (the empty \`"""\\n\\n"""\` shape).
#                                 wolf hides the field from any AI prompt;
#                                 doctor flags it only if REQUIRED.
#   - You explicitly refuse    → write the literal phrase, e.g.
#                                 "Decline to answer" / "Prefer not to say".
#                                 forms will fill that exact text.
#
# Edit:
#   - Use \`wolf profile set <key> <value>\` for simple fields (preserves comments).
#   - Use \`wolf profile add experience\` / \`wolf profile add project\` /
#     \`wolf profile add education\` to append a new resume entry.
#   - For complex changes, edit this file directly with any text editor.
#     Don't delete the comment blocks — they help future-you remember
#     what each field is for.`;

const EXPERIENCE_EXAMPLE = `# ===========================================================================
# Resume content — Experience
# ===========================================================================
#
# Add one [[experience]] block per role. AI agents do this via
# \`wolf profile add experience --slug-from "Amazon, SWE Intern, 2024"\`.
# To remove: \`wolf profile remove experience <id>\`.
#
# Example shape (delete this comment, write your real entries):
#
# [[experience]]
# id = "amazon-internship-2024"           # snake/dash-case slug
# job_title = """Software Engineer Intern"""
# company = """Amazon"""
# start = """2024-06"""                   # YYYY-MM
# end = """2024-09"""                     # YYYY-MM or "Present"
# location = """Seattle, WA"""
# bullets = """
# - Reduced API latency by 40%
# - Led TS migration across 12-person team
# """
# subnote = """
#
# """`;

const PROJECT_EXAMPLE = `# ===========================================================================
# Resume content — Projects
# ===========================================================================
#
# [[project]]
# id = "personal-site-2023"
# name = """Personal site"""
# year = """2023"""
# tech_stack = """
# - Next.js
# - Vercel
# """
# bullets = """
# - Built static blog with MDX
# """
# subnote = """
#
# """`;

const EDUCATION_EXAMPLE = `# ===========================================================================
# Resume content — Education
# ===========================================================================
#
# [[education]]
# id = "university-of-x-2025"
# degree = """B.S. in Computer Science"""
# school = """University of X"""
# start = """2021-09"""
# end = """2025-05"""
# gpa = """3.8/4.0"""
# relevant_coursework = """
# - Algorithms
# - Operating Systems
# """
# subnote = """
#
# """`;

const QUESTIONS_PRELUDE = `# ===========================================================================
# Questions — Q&A pool consumed by fill / tailor / reach (${WOLF_BUILTIN_QUESTIONS.length} builtin prompts seeded below)
# ===========================================================================
#
# Two flavours of builtin question:
#   1. ATS short verbatim Q&A (work auth / sponsorship / relocation /
#      salary / "how did you hear" / "when can you start") — some seeded
#      with sensible defaults you can override.
#   2. Behavioral / opinion long answers (STAR-format stories about
#      failures, conflicts, leadership, etc.) — write your own.
#
# Both flavours live in the same \`[[question]]\` array; downstream consumers
# (wolf fill / tailor / reach) semantic-match the form's question text or
# the JD's requirement against \`prompt\`, then pull \`answer\` verbatim.
#
# Fill in \`answer\` for each one you have an answer for; leave blank to
# skip. wolf doctor flags REQUIRED questions (\`required = true\`) if
# \`answer\` is empty.
#
# Wolf-builtin prompts are wolf-defined: don't change \`prompt\`,
# \`required\`, or \`id\` — those are read-only. You CAN change \`answer\`
# and \`subnote\`. When wolf adds new builtins in a future release,
# missing ones are auto-injected on the next read.`;

const OPTIONAL_RESUME_DIVIDER = `# ===========================================================================
# Optional resume sections — fill what you have.
# ===========================================================================`;

function generateProfileToml(): string {
  const blocks: string[] = [FILE_HEADER];

  // Top-level scalar tables in declared order.
  for (const sec of SECTIONS) {
    blocks.push(renderSectionDivider(sec.title, sec.preamble));
    blocks.push(renderTable(sec.table));
  }

  // Optional resume sections grouped under one divider.
  blocks.push(OPTIONAL_RESUME_DIVIDER);
  for (const t of OPTIONAL_RESUME_TABLES) {
    blocks.push(renderTable(t));
  }

  // Array-of-table example blocks (comment-only, no live entries).
  blocks.push(EXPERIENCE_EXAMPLE);
  blocks.push(PROJECT_EXAMPLE);
  blocks.push(EDUCATION_EXAMPLE);

  // Builtin questions (former form_answers + behavioral stories merged).
  blocks.push(QUESTIONS_PRELUDE);
  for (const q of WOLF_BUILTIN_QUESTIONS) {
    blocks.push(renderBuiltinQuestionBlock(q));
  }

  // Two blank lines between major blocks for readability; trailing newline.
  return blocks.join('\n\n') + '\n';
}

/**
 * The bundled profile.toml content. Generated once at module load and
 * frozen — pure function of PROFILE_FIELDS + WOLF_BUILTIN_QUESTIONS so
 * deterministic across runs.
 */
export const profileTomlTemplate: string = generateProfileToml();
