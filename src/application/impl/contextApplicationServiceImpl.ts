import { isFilled, getByPath, type ProfileToml } from '../../utils/profileToml.js';
import {
  renderProfileMarkdown,
  renderResumePoolMarkdown,
} from '../../utils/profileTomlRender.js';
import { PROFILE_FIELDS } from '../../utils/profileFields.js';
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
 *   demographics / questions. The header tells the agent
 *   to honour hard-rejects, sponsorship limits, salary floors.
 *
 * - `tailor` — drives the resume / cover-letter writer. Sees identity +
 *   contact + job_preferences + full experience + skills + questions. NOT
 *   used by `wolf tailor` itself (that command builds its own prompt
 *   internally), but available for any wrapper / orchestrator that
 *   wants to drive tailor through chat.
 *
 * # How field selection works (search)
 *
 * Field membership in the search bundle is declared on PROFILE_FIELDS via
 * `inSearchContext: true`. The renderer below loops that list — there is
 * no second hand-maintained "fields to dump" array. Adding / removing a
 * field from search context is a one-character change on the spec.
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

  // ## User preferences — single loop over PROFILE_FIELDS, no special
  // formatting per field. Multi-line values get a heading-only line then
  // the body, so AI sees clean shape without the field name competing
  // with the bullet list on the same line.
  const prefLines: string[] = [];
  for (const f of PROFILE_FIELDS) {
    if (!f.inSearchContext) continue;
    if (!f.heading) continue;
    const v = getByPath(toml, f.path);
    if (typeof v !== 'string' || !isFilled(v)) continue;
    appendField(prefLines, f.heading, v);
  }
  if (prefLines.length > 0) {
    lines.push('## User preferences');
    lines.push('');
    lines.push(...prefLines);
    lines.push('');
  }

  // β.10i: removed the separate `## User notes` block. Notes that affect
  // search now flow through the main loop above (job_preferences.note +
  // clearance.note carry inSearchContext: true), so the AI sees them
  // attached to the table they belong to instead of pulled out and
  // detached from context. Per-entry subnotes (experience.<id>.subnote
  // etc.) are intentionally not in search context — search is a snapshot,
  // tailor context is where full resume detail lives.

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
  lines.push('- Notes attached to a section capture user preferences expressed in past');
  lines.push('  chats — weigh as the user\'s signals, but the user can always override per-search.');

  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

/** Append `<heading>: <value>` for single-line values, or `<heading>:\n<body>`
 *  for multi-line ones. Keeps headings visually aligned for the AI even
 *  when the value contains markdown bullets. */
function appendField(out: string[], heading: string, value: string): void {
  const trimmed = value.trim();
  if (trimmed.includes('\n')) {
    out.push(`${heading}:`);
    out.push(trimmed);
  } else {
    out.push(`${heading}: ${trimmed}`);
  }
}

// ---------------------------------------------------------------------------
// scenario: tailor
// ---------------------------------------------------------------------------

function renderTailorContext(toml: ProfileToml): string {
  const lines: string[] = [];

  lines.push('# Wolf tailor context');
  lines.push('');
  lines.push("Identity / preferences / experience / Q&A the resume + cover-letter");
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

  // β.10g: unified Q&A pool — short ATS verbatim answers + behavioral STAR
  // stories live in the same `[[question]]` array; renderer treats them
  // uniformly. Only filled answers surface in tailor context.
  const qaLines: string[] = [];
  for (const s of toml.question) {
    if (!isFilled(s.answer)) continue;
    qaLines.push(`### ${s.prompt.trim()}`);
    qaLines.push(s.answer.trim());
    if (isFilled(s.subnote)) {
      qaLines.push('');
      qaLines.push(`> Notes: ${oneLine(s.subnote)}`);
    }
    qaLines.push('');
  }
  if (qaLines.length > 0) {
    lines.push('# Q&A');
    lines.push('');
    lines.push(...qaLines);
  }

  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Folds multi-line text into a single line for compact "small thoughts"
 *  display. Newlines collapse to ` ⏎ ` (visible, but doesn't wrap). */
function oneLine(text: string): string {
  return text.trim().replace(/\s*\n\s*/g, ' ⏎ ');
}

/** Builds the "user experience snapshot" line: entry counts + skills excerpt. */
function renderExperienceSnapshot(toml: ProfileToml): string {
  const expCount = toml.experience.filter((e) => isFilled(e.job_title) || isFilled(e.bullets)).length;
  const projCount = toml.project.filter((p) => isFilled(p.name) || isFilled(p.bullets)).length;
  const eduCount = toml.education.filter((e) => isFilled(e.degree) || isFilled(e.school)).length;
  const lines: string[] = [];
  if (expCount + projCount + eduCount > 0) {
    const counts: string[] = [];
    if (expCount) counts.push(`${expCount} experience entr${expCount === 1 ? 'y' : 'ies'}`);
    if (projCount) counts.push(`${projCount} project${projCount === 1 ? '' : 's'}`);
    if (eduCount) counts.push(`${eduCount} education entr${eduCount === 1 ? 'y' : 'ies'}`);
    lines.push(counts.join(', '));
  }
  // β.10i: skills collapsed from 5 sub-fields into one freeform text.
  // Surface a one-line excerpt (first line trimmed) so the search agent
  // gets a quick "what stack" hint without a multi-paragraph dump.
  if (isFilled(toml.skills.text)) {
    const firstLine = toml.skills.text.trim().split('\n')[0].trim();
    if (firstLine.length > 0) lines.push(`Stack: ${firstLine}`);
  }
  return lines.join('\n');
}
