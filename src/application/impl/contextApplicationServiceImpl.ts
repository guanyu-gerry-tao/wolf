import { isFilled, type ProfileToml } from '../../utils/profileToml.js';
import {
  renderProfileMarkdown,
  renderResumePoolMarkdown,
} from '../../utils/profileTomlRender.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type {
  ContextApplicationService,
  ContextScenario,
} from '../contextApplicationService.js';

/**
 * Default `ContextApplicationService` impl. Pulls profile.toml from
 * `ProfileRepository` and renders a scenario-scoped markdown view.
 *
 * Each scenario starts with a short "how to use this" header (so the
 * agent knows what the bundle is for and what NOT to leak), then a body
 * built from the relevant slices of profile.toml.
 *
 * # Scenario coverage
 *
 * - `search` — drives a search-time agent (browsing jobs in the user's
 *   browser). Sees ONLY job_preferences + clearance + a coarse
 *   experience snapshot + user notes. No identity / contact / address /
 *   demographics / stories / form answers. The header tells the agent
 *   to honour hard-rejects, sponsorship limits, salary floors.
 *
 * - `tailor` — drives the resume / cover-letter writer. Sees identity +
 *   contact + job_preferences + full experience + skills + stories. NOT
 *   used by `wolf tailor` itself (that command builds its own prompt
 *   internally), but available for any wrapper / orchestrator that
 *   wants to drive tailor through chat.
 */
export class ContextApplicationServiceImpl implements ContextApplicationService {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async render(scenario: ContextScenario, opts: { profileName?: string } = {}): Promise<string> {
    const profile = opts.profileName
      ? (await this.profileRepository.get(opts.profileName))
      : await this.profileRepository.getDefault();
    if (!profile) {
      throw new Error(`Profile not found: ${opts.profileName ?? '<default>'}`);
    }
    const toml = await this.profileRepository.getProfileToml(profile.name);

    if (scenario === 'search') {
      return renderSearchContext(toml);
    }
    if (scenario === 'tailor') {
      return renderTailorContext(toml);
    }
    // Type-narrowing exhaustiveness; should be unreachable.
    const _exhaustive: never = scenario;
    throw new Error(`Unknown context scenario: ${_exhaustive}`);
  }
}

// ---------------------------------------------------------------------------
// scenario: search
// ---------------------------------------------------------------------------

function renderSearchContext(toml: ProfileToml): string {
  const lines: string[] = [];

  lines.push('# Wolf job-search context');
  lines.push('');
  lines.push('Use this section to filter / recommend jobs the user is browsing. Treat');
  lines.push('every preference below as authoritative — surface conflicts to the user');
  lines.push("instead of silently dropping or recommending a job that violates them.");
  lines.push('');

  // ## User preferences — distilled bullet list.
  const prefLines: string[] = [];
  if (isFilled(toml.job_preferences.target_roles)) {
    prefLines.push('Target roles:');
    for (const r of asBullets(toml.job_preferences.target_roles)) prefLines.push(`  - ${r}`);
  }
  if (isFilled(toml.job_preferences.target_locations)) {
    prefLines.push('Target locations:');
    for (const r of asBullets(toml.job_preferences.target_locations)) prefLines.push(`  - ${r}`);
  }
  if (isFilled(toml.job_preferences.remote_preference)) {
    prefLines.push(`Remote preference: ${toml.job_preferences.remote_preference.trim()}`);
  }
  if (isFilled(toml.job_preferences.hard_reject_companies)) {
    prefLines.push('Hard-reject companies (NEVER recommend):');
    for (const c of asBullets(toml.job_preferences.hard_reject_companies)) prefLines.push(`  - ${c}`);
  }
  if (isFilled(toml.job_preferences.precision_apply_companies)) {
    prefLines.push('Precision-apply companies (recommend, but flag manual-apply):');
    for (const c of asBullets(toml.job_preferences.precision_apply_companies)) prefLines.push(`  - ${c}`);
  }
  // Sponsorship strategy (compact one-liner; details in [job_preferences]).
  const sponsor = renderSponsorshipShort(toml);
  if (sponsor) prefLines.push(`Sponsorship: ${sponsor}`);
  if (isFilled(toml.job_preferences.min_hourly_rate_usd)) {
    prefLines.push(`Min hourly rate (intern): $${toml.job_preferences.min_hourly_rate_usd.trim()}`);
  }
  if (isFilled(toml.job_preferences.min_annual_salary_usd)) {
    prefLines.push(`Min annual salary (NG): $${toml.job_preferences.min_annual_salary_usd.trim()}`);
  }
  if (isFilled(toml.job_preferences.scoring_notes)) {
    prefLines.push('');
    prefLines.push('Scoring notes (free-form preferences):');
    prefLines.push(toml.job_preferences.scoring_notes.trim());
  }
  if (prefLines.length > 0) {
    lines.push('## User preferences');
    lines.push('');
    lines.push(...prefLines);
    lines.push('');
  }

  // ## Clearance (affects which jobs are eligible)
  const clrLines: string[] = [];
  if (isFilled(toml.clearance.has_active)) {
    clrLines.push(`Active clearance: ${toml.clearance.has_active.trim()}`);
  }
  if (isFilled(toml.clearance.level)) clrLines.push(`Level: ${toml.clearance.level.trim()}`);
  if (isFilled(toml.clearance.willing_to_obtain)) {
    clrLines.push(`Willing to obtain: ${toml.clearance.willing_to_obtain.trim()}`);
  }
  if (clrLines.length > 0) {
    lines.push('## Clearance');
    lines.push('');
    lines.push(...clrLines);
    lines.push('');
  }

  // ## User notes — collected from each table's `note` field.
  const notes = collectNotes(toml);
  if (notes.length > 0) {
    lines.push('## User notes (small thoughts to weigh)');
    lines.push('');
    for (const n of notes) lines.push(`- (from ${n.source}) ${oneLine(n.text)}`);
    lines.push('');
  }

  // ## User experience snapshot — count + stack hint.
  const summary = renderExperienceSnapshot(toml);
  if (summary) {
    lines.push('## User experience snapshot');
    lines.push('');
    lines.push(summary);
    lines.push('');
  }

  // Footer: how to use.
  lines.push('---');
  lines.push('');
  lines.push('## How to use this');
  lines.push('');
  lines.push('- Hard-reject companies → never recommend.');
  lines.push("- Sponsorship conflicts → flag, don't silently drop.");
  lines.push('- Compensation floor → respect; treat blank floors as "no floor", NOT "free OK".');
  lines.push('- "User notes" capture preferences expressed in past chats — weigh as');
  lines.push('  the user\'s signals, but the user can always override per-search.');

  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

// ---------------------------------------------------------------------------
// scenario: tailor
// ---------------------------------------------------------------------------

function renderTailorContext(toml: ProfileToml): string {
  const lines: string[] = [];

  lines.push('# Wolf tailor context');
  lines.push('');
  lines.push("Identity / preferences / experience / stories the resume + cover-letter");
  lines.push('writers can pull from. Section headings mirror the v1 .md shape so AI');
  lines.push('prompts that expected `## Email\\nvalue` still work.');
  lines.push('');

  // Profile (identity / contact / preferences / clearance) — reuse the
  // existing renderer that already mirrors v1 profile.md.
  const profileMd = renderProfileMarkdown(toml).trim();
  if (profileMd.length > 0) {
    lines.push(profileMd);
    lines.push('');
  }

  // Resume content — full pool.
  const poolMd = renderResumePoolMarkdown(toml).trim();
  if (poolMd.length > 0) {
    lines.push(poolMd);
    lines.push('');
  }

  // Stories — only filled ones; mirror old standard_questions.md story section.
  const storyLines: string[] = [];
  for (const s of toml.story) {
    if (!isFilled(s.star_story)) continue;
    storyLines.push(`### ${s.prompt.trim()}`);
    storyLines.push(s.star_story.trim());
    if (isFilled(s.subnote)) {
      storyLines.push('');
      storyLines.push(`> Notes: ${oneLine(s.subnote)}`);
    }
    storyLines.push('');
  }
  if (storyLines.length > 0) {
    lines.push('# Stories');
    lines.push('');
    lines.push(...storyLines);
  }

  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Splits a multiline-string list into individual non-empty bullet items.
 *  Strips leading bullet markers (`- ` / `* ` / `+ `). */
function asBullets(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[-*+]\s+/, ''));
}

/** Folds multi-line text into a single line for compact "small thoughts"
 *  display. Newlines collapse to ` ⏎ ` (visible, but doesn't wrap). */
function oneLine(text: string): string {
  return text.trim().replace(/\s*\n\s*/g, ' ⏎ ');
}

/** Returns a one-liner like "H-1B = no, OPT = yes". Skips NA values. */
function renderSponsorshipShort(toml: ProfileToml): string {
  const parts: string[] = [];
  const fields: Array<[string, string]> = [
    ['H-1B',  toml.job_preferences.sponsorship_h1b.trim()],
    ['GC',    toml.job_preferences.sponsorship_green_card.trim()],
    ['CPT',   toml.job_preferences.sponsorship_cpt.trim()],
    ['OPT',   toml.job_preferences.sponsorship_opt.trim()],
    ['none',  toml.job_preferences.sponsorship_none.trim()],
  ];
  for (const [label, value] of fields) {
    if (value && value.toUpperCase() !== 'NA') parts.push(`${label} = ${value}`);
  }
  return parts.join(', ');
}

interface CollectedNote {
  source: string;   // e.g. "job_preferences.note", "story.tell_me_about_failure.subnote"
  text: string;
}

/** Walks every `note` / `subnote` field and returns the filled ones. */
function collectNotes(toml: ProfileToml): CollectedNote[] {
  const out: CollectedNote[] = [];
  // Top-level table notes.
  const tables: Array<[string, string]> = [
    ['identity.note',          toml.identity.note],
    ['contact.note',           toml.contact.note],
    ['address.note',           toml.address.note],
    ['links.note',             toml.links.note],
    ['job_preferences.note',   toml.job_preferences.note],
    ['demographics.note',      toml.demographics.note],
    ['clearance.note',         toml.clearance.note],
    ['form_answers.note',      toml.form_answers.note],
    ['documents.note',         toml.documents.note],
    ['resume.note',            toml.resume.note],
  ];
  for (const [source, text] of tables) {
    if (isFilled(text)) out.push({ source, text });
  }
  // Per-entry subnotes.
  for (const e of toml.experience) {
    if (isFilled(e.subnote)) out.push({ source: `experience.${e.id}.subnote`, text: e.subnote });
  }
  for (const p of toml.project) {
    if (isFilled(p.subnote)) out.push({ source: `project.${p.id}.subnote`, text: p.subnote });
  }
  for (const e of toml.education) {
    if (isFilled(e.subnote)) out.push({ source: `education.${e.id}.subnote`, text: e.subnote });
  }
  for (const s of toml.story) {
    if (isFilled(s.subnote)) out.push({ source: `story.${s.id}.subnote`, text: s.subnote });
  }
  return out;
}

/** Builds the "user experience snapshot" line: counts + stack hint. */
function renderExperienceSnapshot(toml: ProfileToml): string {
  const expCount = toml.experience.filter((e) => isFilled(e.job_title) || isFilled(e.bullets)).length;
  const projCount = toml.project.filter((p) => isFilled(p.name) || isFilled(p.bullets)).length;
  const eduCount = toml.education.filter((e) => isFilled(e.degree) || isFilled(e.school)).length;
  const stack: string[] = [];
  if (isFilled(toml.skills.languages))  stack.push(toml.skills.languages.trim());
  if (isFilled(toml.skills.frameworks)) stack.push(toml.skills.frameworks.trim());
  if (isFilled(toml.skills.tools))      stack.push(toml.skills.tools.trim());
  const lines: string[] = [];
  if (expCount + projCount + eduCount > 0) {
    const counts: string[] = [];
    if (expCount) counts.push(`${expCount} experience entr${expCount === 1 ? 'y' : 'ies'}`);
    if (projCount) counts.push(`${projCount} project${projCount === 1 ? '' : 's'}`);
    if (eduCount) counts.push(`${eduCount} education entr${eduCount === 1 ? 'y' : 'ies'}`);
    lines.push(counts.join(', '));
  }
  if (stack.length > 0) {
    lines.push(`Stack: ${stack.join(' / ')}`);
  }
  return lines.join('\n');
}
