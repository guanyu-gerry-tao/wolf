import type { AppContext } from '../../runtime/appContext.js';
import { createAppContext } from '../../runtime/appContext.js';
import { stripComments } from '../../utils/stripComments.js';
import { extractH2Content } from '../../utils/extractH2.js';

/**
 * Per-file readiness report. Empty `missing` array means the file is
 * "ready" by the relevant criterion; non-empty means the user has work
 * to do before tailor / fill / reach will run cleanly.
 */
export interface FileCheck {
  file: string;             // e.g. 'profile.md'
  ready: boolean;
  missing: string[];        // human-readable missing items
  hint: string;             // one-liner pointing the user at the next step
}

export interface DoctorReport {
  profileName: string;
  checks: FileCheck[];
  ready: boolean;           // true iff every check is ready
}

/**
 * Profile.md fields whose H2 body must be non-empty before tailor will run.
 * Same list `assertReadyForTailor` enforces — kept in sync intentionally so
 * doctor reports the exact failures tailor would hit.
 */
const PROFILE_REQUIRED_H2 = [
  'Legal first name',
  'Legal last name',
  'Email',
  'Phone',
] as const;

/** Minimum non-blank, non-heading lines in resume_pool.md (post-strip). */
const POOL_MIN_LINES = 5;

/**
 * Reads the default profile and reports which files still need user input
 * before tailor (and downstream fill / reach when they ship) will run.
 *
 * Pure assessment — never modifies any file.
 */
export async function doctor(
  _options: Record<string, never> = {},
  ctx: AppContext = createAppContext(),
): Promise<DoctorReport> {
  const profile = await ctx.profileRepository.getDefault();

  const profileCheck = checkProfile(profile.md);
  const poolCheck = checkResumePool(
    await ctx.profileRepository.getResumePool(profile.name),
  );
  const sqCheck = checkStandardQuestions(
    await ctx.profileRepository.getStandardQuestions(profile.name),
  );

  const checks = [profileCheck, poolCheck, sqCheck];
  return {
    profileName: profile.name,
    checks,
    ready: checks.every((c) => c.ready),
  };
}

function checkProfile(md: string): FileCheck {
  // Strip first: an H2 whose body is only a `> [!IMPORTANT]` callout
  // (the unfilled-template state) should count as empty, not "answered".
  const stripped = stripComments(md);
  const missing = PROFILE_REQUIRED_H2.filter(
    (field) => extractH2Content(stripped, field).length === 0,
  );
  return {
    file: 'profile.md',
    ready: missing.length === 0,
    missing: [...missing],
    hint: missing.length === 0
      ? 'all REQUIRED identity / contact fields filled'
      : 'fill these H2 sections under # Identity / # Contact in profile.md',
  };
}

function checkResumePool(md: string): FileCheck {
  const stripped = stripComments(md);
  const substantiveLines = stripped
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('#');
    });
  const ready = substantiveLines.length >= POOL_MIN_LINES;
  return {
    file: 'resume_pool.md',
    ready,
    missing: ready ? [] : [`only ${substantiveLines.length} substantive lines (need ≥ ${POOL_MIN_LINES})`],
    hint: ready
      ? 'pool has enough content for tailor'
      : 'add at least one real role with bullets under ## Experience',
  };
}

function checkStandardQuestions(md: string): FileCheck {
  // standard_questions.md lists every form-answer / framework H2 with an
  // > [!IMPORTANT] body when unanswered. Treat the whole file as "ready"
  // when at least 3 H2s have non-callout bodies — the user has at minimum
  // their salary / why-company / why-role written. We don't enforce all
  // 14+ short answers because the user fills incrementally and fill (M4)
  // can pause-and-ask for any missing field at apply time.
  const stripped = stripComments(md);
  const sections = countAnsweredH2s(stripped);
  const ready = sections.answered >= 3;
  return {
    file: 'standard_questions.md',
    ready,
    missing: ready ? [] : [`only ${sections.answered} / ${sections.total} H2 sections have answers`],
    hint: ready
      ? `${sections.answered} / ${sections.total} answered — fill more as you go`
      : 'write answers under at least three H2s (e.g. salary, why this company, why this role)',
  };
}

// Counts H2 sections whose body has any non-blank content beyond block-only
// callouts. After stripComments removes `> [!XYZ]` blocks, an "unanswered"
// section's body is just blank lines.
function countAnsweredH2s(stripped: string): { answered: number; total: number } {
  const lines = stripped.split('\n');
  let total = 0;
  let answered = 0;
  let i = 0;
  while (i < lines.length) {
    const m = /^##\s+(.*)$/.exec(lines[i]);
    if (!m) { i++; continue; }
    total++;
    i++;
    let hasBody = false;
    while (i < lines.length && !/^#{1,2}\s/.test(lines[i])) {
      if (lines[i].trim().length > 0) { hasBody = true; }
      i++;
    }
    if (hasBody) answered++;
  }
  return { answered, total };
}

/** Render a DoctorReport as user-facing text. Pure formatter. */
export function formatDoctor(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(`wolf doctor — profile readiness check`);
  lines.push(``);
  lines.push(`Profile: ${report.profileName}`);
  lines.push(``);
  for (const c of report.checks) {
    const mark = c.ready ? '✓' : '✗';
    lines.push(`${mark} ${c.file}`);
    if (c.missing.length > 0) {
      for (const m of c.missing) lines.push(`    - ${m}`);
    }
    lines.push(`    ${c.hint}`);
    lines.push(``);
  }
  lines.push(`Status: ${report.ready ? 'READY' : 'NOT READY'}`);
  if (!report.ready) {
    lines.push(``);
    lines.push(`Open profiles/${report.profileName}/profile.md and fill the > [!IMPORTANT]`);
    lines.push(`sections, then re-run \`wolf doctor\`.`);
  }
  return lines.join('\n');
}
