import fs from 'node:fs';
import { chromium } from 'playwright';
import { stripComments } from '../../utils/stripComments.js';
import { extractH2Content } from '../../utils/extractH2.js';
import { getEnvValue, currentBinaryName } from '../../utils/instance.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type {
  DoctorApplicationService,
  DoctorReport,
  FileCheck,
} from '../doctorApplicationService.js';

// Profile.md fields whose H2 body must be non-empty before tailor will run.
// Same list `assertReadyForTailor` enforces — kept in sync intentionally so
// doctor reports the exact failures tailor would hit.
const PROFILE_REQUIRED_H2 = [
  'Legal first name',
  'Legal last name',
  'Email',
  'Phone',
] as const;

// Minimum non-blank, non-heading lines in resume_pool.md (post-strip).
const POOL_MIN_LINES = 5;

/**
 * `DoctorApplicationService` impl. Reads the default profile through
 * `ProfileRepository`, runs three pure check functions (`profile.md`,
 * `resume_pool.md`, `standard_questions.md`), and aggregates them into a
 * `DoctorReport`. Each check strips runtime-only callouts before measuring,
 * so unfilled templates correctly report empty.
 */
export class DoctorApplicationServiceImpl implements DoctorApplicationService {
  constructor(private readonly profileRepository: ProfileRepository) {}

  /** @inheritdoc */
  async run(): Promise<DoctorReport> {
    const profile = await this.profileRepository.getDefault();

    const profileCheck = checkProfile(profile.md);
    const poolCheck = checkResumePool(
      await this.profileRepository.getResumePool(profile.name),
    );
    const sqCheck = checkStandardQuestions(
      await this.profileRepository.getStandardQuestions(profile.name),
    );

    // Runtime preflight checks — fail fast on these and tailor will error
    // before any AI call. Reported alongside the profile checks so the user
    // sees one consolidated readiness picture.
    const apiKeyCheck = checkAnthropicKey();
    const chromiumCheck = checkPlaywrightChromium();

    const checks = [profileCheck, poolCheck, sqCheck, apiKeyCheck, chromiumCheck];
    return {
      profileName: profile.name,
      checks,
      ready: checks.every((c) => c.ready),
    };
  }
}

// API key check — uses `getEnvValue` so dev builds correctly read
// `WOLF_DEV_ANTHROPIC_API_KEY` with fallback to `WOLF_ANTHROPIC_API_KEY`.
function checkAnthropicKey(): FileCheck {
  const value = getEnvValue('ANTHROPIC_API_KEY');
  const ready = !!value && value.length > 0;
  return {
    file: 'WOLF_ANTHROPIC_API_KEY',
    ready,
    missing: ready ? [] : ['environment variable not set'],
    hint: ready
      ? 'API key present'
      : `run \`${currentBinaryName()} env set\` or get a key at https://console.anthropic.com/`,
  };
}

// Chromium presence — pure stat check, no spawning. Tailor's render service
// will auto-install on first use, but doctor lets the user pre-warm the
// install (and confirms the auto-install actually persisted) before the
// first tailor run.
function checkPlaywrightChromium(): FileCheck {
  const exe = chromium.executablePath();
  const ready = !!exe && fs.existsSync(exe);
  return {
    file: 'Playwright Chromium',
    ready,
    missing: ready ? [] : ['binary not found'],
    hint: ready
      ? 'Chromium installed (tailor render path is ready)'
      : `run \`npx playwright install chromium\` (~150 MB), or just run \`${currentBinaryName()} tailor\` once and wolf will auto-install it`,
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
  // Treat the whole file as "ready" when at least 3 H2s have non-callout
  // bodies — fill (M4) can pause-and-ask for any missing field at apply time.
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
