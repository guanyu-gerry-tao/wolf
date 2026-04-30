import type { ProfileToml } from './profileToml.js';
import { isFilled, getByPath } from './profileToml.js';
import { PROFILE_FIELDS, type FieldMeta } from './profileFields.js';

/**
 * Renders a parsed `profile.toml` back into the markdown shapes that
 * existing consumers (tailor, doctor's hint text, AI prompt builders)
 * expect. v1 wolf had three separate .md files; v2 has a single TOML.
 * These renderers paper over that change for the prompt-injection paths
 * so we don't have to rewrite tailor / fill / reach prompt builders to
 * consume structured TOML directly. They produce markdown that mirrors
 * the v1 shape closely enough that an AI prompt expecting `## Email\n
 * gerry@example.com` still works.
 *
 * # Single source of truth: PROFILE_FIELDS
 *
 * Per-field labels (`heading`) and section assignment (`section`) live on
 * `PROFILE_FIELDS` in `profileFields.ts`. Each renderer below loops over
 * that list filtered by `section`, instead of hand-spelling
 * `pushFieldIfFilled(out, "Email", toml.contact.email)` for every field.
 * Adding a new field means setting one entry — no second touchpoint here.
 *
 * # What the loops can NOT express (and we hand-render)
 *
 * - **Skills** as a one-block summary (Languages / Frameworks / Tools /
 *   ...) — emitted as one `## Skills` block off `skills.text`.
 *   β.10i collapsed the old categorized 5 sub-fields into one freeform.
 * - **Per-entry array-of-table content** (experience / project / education
 *   / question) — these aren't fields with paths in PROFILE_FIELDS; they
 *   loop over `toml.experience` etc. directly.
 * - **Resume layout note** (`resume.section_order`) — printed as a
 *   `> blockquote` header on resume_pool, not an `## H2`.
 *
 * # No more combined views (β.10f)
 *
 * Earlier drafts had `renderRelocationCombined` / `renderSponsorshipCombined`
 * to merge 4-5 sibling pseudo-enum fields into one bullet block. We removed
 * those: the underlying schema fields collapsed into single freeform
 * `relocation_preferences` / `sponsorship_preferences` fields, so the
 * main loop emits them like any other field.
 *
 * # H1 grouping (profile_md / standard_questions)
 *
 * Each H1 block is a TOML table. The mapping `<table> → <H1>` is the
 * `H1_GROUPS` list below; per-table iteration filters PROFILE_FIELDS by
 * `path.startsWith('${table}.')`.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Append `## <heading>\n<value>` to lines if value is filled. */
function pushFieldIfFilled(lines: string[], heading: string, value: string): void {
  if (!isFilled(value)) return;
  lines.push(`## ${heading}`);
  lines.push(value.trim());
  lines.push(''); // separator
}

/** Append the `# <h1>` block if any of its fields produced output. */
function pushH1Block(lines: string[], h1: string, blockLines: string[]): void {
  if (blockLines.length === 0) return;
  lines.push(`# ${h1}`);
  lines.push('');
  lines.push(...blockLines);
}

/** Read a string field by path off the parsed profile, defaulting to ''
 *  if anything's missing or non-string. Wraps `getByPath` for renderer
 *  ergonomics — renderers only care about strings. */
function readString(toml: ProfileToml, path: string): string {
  const v = getByPath(toml, path);
  return typeof v === 'string' ? v : '';
}

/** For a given top-level table, append `## heading\n<value>` for every
 *  PROFILE_FIELDS entry under that table that has the given section
 *  AND a heading AND a filled value. Order = PROFILE_FIELDS declaration
 *  order. */
function emitFieldsForTable(
  toml: ProfileToml,
  out: string[],
  table: string,
  section: FieldMeta['section'],
): void {
  for (const f of PROFILE_FIELDS) {
    if (f.section !== section) continue;
    if (!f.heading) continue;
    if (!f.path.startsWith(`${table}.`)) continue;
    pushFieldIfFilled(out, f.heading, readString(toml, f.path));
  }
}

// ---------------------------------------------------------------------------
// renderProfileMarkdown — identity / contact / address / links /
// job_preferences / demographics / clearance. Format-stable mirror of
// the old profile.md shape.
// ---------------------------------------------------------------------------

/** Top-level table → H1 heading, in render order, for profile_md. */
const PROFILE_MD_GROUPS: ReadonlyArray<{ table: string; h1: string }> = [
  { table: 'identity',         h1: 'Identity' },
  { table: 'contact',          h1: 'Contact' },
  { table: 'address',          h1: 'Address' },
  { table: 'links',            h1: 'Links' },
  { table: 'job_preferences',  h1: 'Job Preferences' },
  { table: 'demographics',     h1: 'Demographics' },
  { table: 'clearance',        h1: 'Clearance' },
];

export function renderProfileMarkdown(toml: ProfileToml): string {
  const out: string[] = [];

  // Every group is now a pure metadata-driven loop. β.10f collapsed the
  // relocation/sponsorship cross-field combined views into single freeform
  // fields, so the special-case branch for job_preferences is gone.
  for (const { table, h1 } of PROFILE_MD_GROUPS) {
    const block: string[] = [];
    emitFieldsForTable(toml, block, table, 'profile_md');
    pushH1Block(out, h1, block);
  }

  return out.join('\n').trimEnd() + '\n';
}

// ---------------------------------------------------------------------------
// renderResumePoolMarkdown — [[experience]] / [[project]] / [[education]] /
// [skills] / and every optional resume section.
// ---------------------------------------------------------------------------

export function renderResumePoolMarkdown(toml: ProfileToml): string {
  const out: string[] = [];

  // Resume layout note (if any) goes first as a header context.
  if (isFilled(toml.resume.section_order)) {
    out.push('# Resume Pool');
    out.push('');
    out.push('> Section order preference (resume layout):');
    out.push(toml.resume.section_order.trim());
    out.push('');
  } else {
    out.push('# Resume Pool');
    out.push('');
  }

  // ## Experience (one ### per entry, identified by id).
  if (toml.experience.length > 0) {
    out.push('## Experience');
    out.push('');
    for (const e of toml.experience) {
      out.push(`### ${e.id}`);
      const parts: string[] = [];
      if (isFilled(e.job_title)) parts.push(`**${e.job_title.trim()}**`);
      if (isFilled(e.company))   parts.push(`@ ${e.company.trim()}`);
      if (parts.length) out.push(parts.join(' '));
      const meta: string[] = [];
      if (isFilled(e.start) || isFilled(e.end)) {
        meta.push(`${e.start.trim()} — ${e.end.trim()}`);
      }
      if (isFilled(e.location)) meta.push(e.location.trim());
      if (meta.length) out.push(`*${meta.join(' • ')}*`);
      if (isFilled(e.bullets)) {
        out.push('');
        out.push(e.bullets.trim());
      }
      if (isFilled(e.subnote)) {
        out.push('');
        out.push(`> Notes: ${e.subnote.trim().replace(/\n/g, ' ')}`);
      }
      out.push('');
    }
  }

  // ## Projects
  if (toml.project.length > 0) {
    out.push('## Projects');
    out.push('');
    for (const p of toml.project) {
      out.push(`### ${p.id}`);
      const head: string[] = [];
      if (isFilled(p.name)) head.push(`**${p.name.trim()}**`);
      if (isFilled(p.year)) head.push(`(${p.year.trim()})`);
      if (head.length) out.push(head.join(' '));
      if (isFilled(p.tech_stack)) {
        out.push('');
        out.push('Stack:');
        out.push(p.tech_stack.trim());
      }
      if (isFilled(p.bullets)) {
        out.push('');
        out.push(p.bullets.trim());
      }
      if (isFilled(p.subnote)) {
        out.push('');
        out.push(`> Notes: ${p.subnote.trim().replace(/\n/g, ' ')}`);
      }
      out.push('');
    }
  }

  // ## Education
  if (toml.education.length > 0) {
    out.push('## Education');
    out.push('');
    for (const e of toml.education) {
      out.push(`### ${e.id}`);
      const head: string[] = [];
      if (isFilled(e.degree)) head.push(`**${e.degree.trim()}**`);
      if (isFilled(e.school)) head.push(`@ ${e.school.trim()}`);
      if (head.length) out.push(head.join(' '));
      const meta: string[] = [];
      if (isFilled(e.start) || isFilled(e.end)) {
        meta.push(`${e.start.trim()} — ${e.end.trim()}`);
      }
      if (isFilled(e.gpa)) meta.push(`GPA ${e.gpa.trim()}`);
      if (meta.length) out.push(`*${meta.join(' • ')}*`);
      if (isFilled(e.relevant_coursework)) {
        out.push('');
        out.push('Relevant coursework:');
        out.push(e.relevant_coursework.trim());
      }
      if (isFilled(e.subnote)) {
        out.push('');
        out.push(`> Notes: ${e.subnote.trim().replace(/\n/g, ' ')}`);
      }
      out.push('');
    }
  }

  // ## Skills — β.10i collapsed 5 sub-fields into one freeform `text`.
  // Render the value verbatim under one `## Skills` heading.
  if (isFilled(toml.skills.text)) {
    out.push('## Skills');
    out.push(toml.skills.text.trim());
    out.push('');
  }

  // Optional resume sections (awards / publications / hackathons / ...).
  // Each contributes one `## heading` if its single content field is filled.
  // Drives off PROFILE_FIELDS — adding a new optional section means flipping
  // its `.items` (or single content field) to section: 'resume_pool_optional'.
  for (const f of PROFILE_FIELDS) {
    if (f.section !== 'resume_pool_optional') continue;
    if (!f.heading) continue;
    pushFieldIfFilled(out, f.heading, readString(toml, f.path));
  }

  return out.join('\n').trimEnd() + '\n';
}

// ---------------------------------------------------------------------------
// renderStandardQuestionsMarkdown — [[question]] (former form_answers + stories) + [documents].
// ---------------------------------------------------------------------------

export function renderStandardQuestionsMarkdown(toml: ProfileToml): string {
  const out: string[] = [];

  // # Q&A — one ## per filled question. Mixed bag: short ATS answers
  // (work auth, sponsorship, "how did you hear") + behavioral STAR
  // stories. Both flavours render the same way.
  const qaBlock: string[] = [];
  for (const q of toml.question) {
    if (!isFilled(q.answer)) continue;
    qaBlock.push(`## ${q.prompt.trim()}`);
    qaBlock.push(q.answer.trim());
    if (isFilled(q.subnote)) {
      qaBlock.push('');
      qaBlock.push(`> Notes: ${q.subnote.trim().replace(/\n/g, ' ')}`);
    }
    qaBlock.push('');
  }
  pushH1Block(out, 'Q&A', qaBlock);

  // # Documents — driven off PROFILE_FIELDS.
  const docs: string[] = [];
  emitFieldsForTable(toml, docs, 'documents', 'standard_questions');
  pushH1Block(out, 'Documents', docs);

  return out.join('\n').trimEnd() + '\n';
}
