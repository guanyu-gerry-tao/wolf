import type { ProfileToml } from './profileToml.js';
import { isFilled } from './profileToml.js';

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
 * # What gets rendered, by entry point
 *
 * - `renderProfileMarkdown(toml)` — identity / contact / address / links /
 *   job_preferences / demographics / clearance. Mirrors the old
 *   profile.md shape.
 *
 * - `renderResumePoolMarkdown(toml)` — [[experience]] / [[project]] /
 *   [[education]] / [skills] / and every optional resume section
 *   (awards, publications, hackathons, etc.). Mirrors the old
 *   resume_pool.md shape; per-entry uses H3 with `### <id>` so the
 *   AI can tell entries apart.
 *
 * - `renderStandardQuestionsMarkdown(toml)` — [form_answers] +
 *   [[story]] + [documents]. Mirrors the old standard_questions.md.
 *
 * # What's NOT rendered
 *
 * Empty fields (post-`isFilled` check) are skipped so the AI doesn't
 * see a wall of empty H2 stubs. This is the same behavior the old
 * stripComments + dropEmptyH2s mode produced.
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

// ---------------------------------------------------------------------------
// renderProfileMarkdown — identity / contact / address / links /
// job_preferences / demographics / clearance. Format-stable mirror of
// the old profile.md shape.
// ---------------------------------------------------------------------------

export function renderProfileMarkdown(toml: ProfileToml): string {
  const out: string[] = [];

  // # Identity
  const identity: string[] = [];
  pushFieldIfFilled(identity, 'Legal first name',           toml.identity.legal_first_name);
  pushFieldIfFilled(identity, 'Legal middle name',          toml.identity.legal_middle_name);
  pushFieldIfFilled(identity, 'Legal last name',            toml.identity.legal_last_name);
  pushFieldIfFilled(identity, 'Preferred name',             toml.identity.preferred_name);
  pushFieldIfFilled(identity, 'Pronouns',                   toml.identity.pronouns);
  pushFieldIfFilled(identity, 'Date of birth',              toml.identity.date_of_birth);
  pushFieldIfFilled(identity, 'Country of citizenship',     toml.identity.country_of_citizenship);
  pushFieldIfFilled(identity, "Country you're currently in", toml.identity.country_currently_in);
  pushH1Block(out, 'Identity', identity);

  // # Contact
  const contact: string[] = [];
  pushFieldIfFilled(contact, 'Email', toml.contact.email);
  pushFieldIfFilled(contact, 'Phone', toml.contact.phone);
  pushH1Block(out, 'Contact', contact);

  // # Address
  const address: string[] = [];
  pushFieldIfFilled(address, 'Full address', toml.address.full);
  pushH1Block(out, 'Address', address);

  // # Links
  const links: string[] = [];
  pushFieldIfFilled(links, 'First link (most prominent on resume)',         toml.links.first);
  pushFieldIfFilled(links, "Second link (also on resume if there's room)",  toml.links.second);
  pushFieldIfFilled(links, 'Other links',                                   toml.links.others);
  pushH1Block(out, 'Links', links);

  // # Job Preferences
  const prefs: string[] = [];
  pushFieldIfFilled(prefs, 'Target roles',          toml.job_preferences.target_roles);
  pushFieldIfFilled(prefs, 'Target locations',      toml.job_preferences.target_locations);
  pushFieldIfFilled(prefs, 'Remote preference',     toml.job_preferences.remote_preference);
  // Relocation: render the YES/NO matrix + free text as one combined section
  // so AI sees the strategic shape without separate YES/NO/MAYBE lines.
  const reloc = renderRelocationCombined(toml);
  if (reloc) {
    prefs.push('## Relocation preference');
    prefs.push(reloc);
    prefs.push('');
  }
  // Sponsorship: same pattern.
  const sponsor = renderSponsorshipCombined(toml);
  if (sponsor) {
    prefs.push('## Sponsorship preference');
    prefs.push(sponsor);
    prefs.push('');
  }
  pushFieldIfFilled(prefs, 'Hard-reject companies',         toml.job_preferences.hard_reject_companies);
  pushFieldIfFilled(prefs, 'Precision-apply companies',     toml.job_preferences.precision_apply_companies);
  pushFieldIfFilled(prefs, 'Minimum hourly rate (intern, USD)',  toml.job_preferences.min_hourly_rate_usd);
  pushFieldIfFilled(prefs, 'Minimum annual salary (new grad, USD)', toml.job_preferences.min_annual_salary_usd);
  pushFieldIfFilled(prefs, 'Scoring notes',                 toml.job_preferences.scoring_notes);
  if (isFilled(toml.job_preferences.note)) {
    prefs.push('## User notes');
    prefs.push(toml.job_preferences.note.trim());
    prefs.push('');
  }
  pushH1Block(out, 'Job Preferences', prefs);

  // # Demographics
  const demo: string[] = [];
  pushFieldIfFilled(demo, 'Race',                                 toml.demographics.race);
  pushFieldIfFilled(demo, 'Gender',                               toml.demographics.gender);
  pushFieldIfFilled(demo, 'Ethnicity',                            toml.demographics.ethnicity);
  pushFieldIfFilled(demo, 'Veteran status',                       toml.demographics.veteran_status);
  pushFieldIfFilled(demo, 'Disability status',                    toml.demographics.disability_status);
  pushFieldIfFilled(demo, 'LGBTQ+',                               toml.demographics.lgbtq);
  pushFieldIfFilled(demo, 'Transgender',                          toml.demographics.transgender);
  pushFieldIfFilled(demo, 'First-generation college student',     toml.demographics.first_gen_college);
  pushH1Block(out, 'Demographics', demo);

  // # Clearance
  const clr: string[] = [];
  pushFieldIfFilled(clr, 'Do you have an active security clearance?', toml.clearance.has_active);
  pushFieldIfFilled(clr, 'Clearance level',  toml.clearance.level);
  pushFieldIfFilled(clr, 'Clearance status', toml.clearance.status);
  pushFieldIfFilled(clr, 'Are you willing to obtain one?', toml.clearance.willing_to_obtain);
  pushH1Block(out, 'Clearance', clr);

  return out.join('\n').trimEnd() + '\n';
}

/** Combine the four relocation YES/NO/MAYBE flags + free text into one
 *  bullet block AI can grok. Returns '' if nothing's set. */
function renderRelocationCombined(toml: ProfileToml): string {
  const parts: string[] = [];
  const m = toml.job_preferences.relocation_within_metro.trim();
  const s = toml.job_preferences.relocation_within_state.trim();
  const c = toml.job_preferences.relocation_cross_country.trim();
  const i = toml.job_preferences.relocation_international.trim();
  if (m) parts.push(`- within current metro area: ${m}`);
  if (s) parts.push(`- within current state: ${s}`);
  if (c) parts.push(`- cross-country: ${c}`);
  if (i) parts.push(`- international: ${i}`);
  if (isFilled(toml.job_preferences.relocation_free_text)) {
    parts.push('');
    parts.push('Notes:');
    parts.push(toml.job_preferences.relocation_free_text.trim());
  }
  return parts.join('\n');
}

function renderSponsorshipCombined(toml: ProfileToml): string {
  const parts: string[] = [];
  const fields: Array<[string, string]> = [
    ['require H-1B sponsorship',        toml.job_preferences.sponsorship_h1b.trim()],
    ['require green-card sponsorship',  toml.job_preferences.sponsorship_green_card.trim()],
    ['require CPT (current student)',   toml.job_preferences.sponsorship_cpt.trim()],
    ['require OPT (current student)',   toml.job_preferences.sponsorship_opt.trim()],
    ["don't sponsor at all",            toml.job_preferences.sponsorship_none.trim()],
  ];
  for (const [label, value] of fields) {
    if (value) parts.push(`- ${label}: ${value}`);
  }
  if (isFilled(toml.job_preferences.sponsorship_free_text)) {
    parts.push('');
    parts.push('Notes:');
    parts.push(toml.job_preferences.sponsorship_free_text.trim());
  }
  return parts.join('\n');
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

  // ## Skills
  const skills = renderSkillsBody(toml);
  if (skills) {
    out.push('## Skills');
    out.push(skills);
    out.push('');
  }

  // Optional resume sections — each has a `.items` field (or `.free_text`
  // for [interests]). Render only sections with content.
  const optionalSections: Array<[string, string]> = [
    ['Awards & Honors', toml.awards.items],
    ['Publications',    toml.publications.items],
    ['Patents',         toml.patents.items],
    ['Hackathons',      toml.hackathons.items],
    ['Open Source',     toml.open_source.items],
    ['Certifications',  toml.certifications.items],
    ['Languages',       toml.languages_spoken.items],
    ['Volunteer',       toml.volunteer.items],
    ['Speaking',        toml.speaking.items],
  ];
  for (const [heading, body] of optionalSections) {
    if (!isFilled(body)) continue;
    out.push(`## ${heading}`);
    out.push(body.trim());
    out.push('');
  }
  // Interests is a free_text scalar.
  if (isFilled(toml.interests.free_text)) {
    out.push('## Interests');
    out.push(toml.interests.free_text.trim());
    out.push('');
  }

  return out.join('\n').trimEnd() + '\n';
}

/** Combines [skills] sub-fields into a single body block. */
function renderSkillsBody(toml: ProfileToml): string {
  const lines: string[] = [];
  if (isFilled(toml.skills.languages))  lines.push(`Languages: ${toml.skills.languages.trim()}`);
  if (isFilled(toml.skills.frameworks)) lines.push(`Frameworks: ${toml.skills.frameworks.trim()}`);
  if (isFilled(toml.skills.tools))      lines.push(`Tools: ${toml.skills.tools.trim()}`);
  if (isFilled(toml.skills.domains))    lines.push(`Domains: ${toml.skills.domains.trim()}`);
  if (isFilled(toml.skills.free_text))  lines.push(toml.skills.free_text.trim());
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// renderStandardQuestionsMarkdown — [form_answers] + [[story]] + [documents].
// ---------------------------------------------------------------------------

export function renderStandardQuestionsMarkdown(toml: ProfileToml): string {
  const out: string[] = [];

  // # Short Answers (form_answers)
  const sa: string[] = [];
  pushFieldIfFilled(sa, "What's your salary expectation?",       toml.form_answers.salary_expectation);
  pushFieldIfFilled(sa, 'How did you hear about us?',            toml.form_answers.how_did_you_hear);
  pushFieldIfFilled(sa, 'When can you start?',                   toml.form_answers.when_can_you_start);
  pushFieldIfFilled(sa, 'Form answer — Are you authorized to work?',     toml.form_answers.authorized_to_work);
  pushFieldIfFilled(sa, 'Form answer — Do you require sponsorship?',     toml.form_answers.require_sponsorship);
  pushFieldIfFilled(sa, 'Form answer — Are you willing to relocate?',    toml.form_answers.willing_to_relocate);
  pushH1Block(out, 'Short Answers', sa);

  // # Stories — one ## per filled story, prompt as heading, star_story as body.
  const storiesBlock: string[] = [];
  for (const story of toml.story) {
    if (!isFilled(story.star_story)) continue;
    storiesBlock.push(`## ${story.prompt.trim()}`);
    storiesBlock.push(story.star_story.trim());
    if (isFilled(story.subnote)) {
      storiesBlock.push('');
      storiesBlock.push(`> Notes: ${story.subnote.trim().replace(/\n/g, ' ')}`);
    }
    storiesBlock.push('');
  }
  pushH1Block(out, 'Stories', storiesBlock);

  // # Documents
  const docs: string[] = [];
  pushFieldIfFilled(docs, 'Transcript',           toml.documents.transcript);
  pushFieldIfFilled(docs, 'Unofficial transcript', toml.documents.unofficial_transcript);
  pushFieldIfFilled(docs, 'Reference letter',     toml.documents.reference_letter);
  pushFieldIfFilled(docs, 'Portfolio sample',     toml.documents.portfolio_sample);
  pushH1Block(out, 'Documents', docs);

  return out.join('\n').trimEnd() + '\n';
}
