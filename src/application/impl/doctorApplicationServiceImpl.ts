import fs from 'node:fs';
import { chromium } from 'playwright';
import { getEnvValue, currentBinaryName } from '../../utils/instance.js';
import {
  REQUIRED_PROFILE_FIELDS,
  WOLF_BUILTIN_STORIES,
  type FieldMeta,
} from '../../utils/profileFields.js';
import { isFilled, getByPath, type ProfileToml } from '../../utils/profileToml.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type {
  DoctorApplicationService,
  DoctorReport,
  FileCheck,
} from '../doctorApplicationService.js';

// Resume content threshold — total non-empty bullets / list items across all
// experience / project / education / skills entries. 5 is "at least one real
// role with three bullets, plus a couple of skills" — enough that the AI has
// material to work with without forcing the user to be exhaustive on day one.
const RESUME_MIN_ENTRIES = 5;

// Stories threshold — how many builtin behavioral prompts the user must have
// answered before tailor / fill consider the workspace ready. fill (M4) can
// still pause-and-ask for any missing field at apply time, so this is a
// "you've started populating stories" check, not "every story filled".
const STORIES_MIN_ANSWERED = 3;

/**
 * `DoctorApplicationService` impl. Reads the default profile through
 * `ProfileRepository.getProfileToml`, runs four pure check functions
 * (profile / resume pool / stories + form_answers / runtime), and aggregates
 * them into a `DoctorReport`. Every check pulls from the same source-of-truth
 * tables (`PROFILE_FIELDS` and `WOLF_BUILTIN_STORIES`) so doctor's view of
 * "ready" stays in lockstep with `wolf profile fields`.
 */
export class DoctorApplicationServiceImpl implements DoctorApplicationService {
  constructor(private readonly profileRepository: ProfileRepository) {}

  /** @inheritdoc */
  async run(): Promise<DoctorReport> {
    const profile = await this.profileRepository.getDefault();
    const toml = await this.profileRepository.getProfileToml(profile.name);

    const profileCheck = checkProfileFields(toml);
    const poolCheck = checkResumeContent(toml);
    const sqCheck = checkStoriesAndFormAnswers(toml);

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

// ---------------------------------------------------------------------------
// API key + Chromium runtime checks — unchanged from v1.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// profile.toml — REQUIRED scalar fields per PROFILE_FIELDS
// ---------------------------------------------------------------------------

/**
 * Walks `REQUIRED_PROFILE_FIELDS` and reports any whose value (looked up
 * via `getByPath`) is empty after trimming. Each missing entry includes
 * the field's help text so the doctor output is actionable directly.
 */
function checkProfileFields(toml: ProfileToml): FileCheck {
  const missingFields: FieldMeta[] = [];
  for (const field of REQUIRED_PROFILE_FIELDS) {
    const value = getByPath(toml, field.path);
    const filled = typeof value === 'string' ? isFilled(value) : value !== undefined;
    if (!filled) missingFields.push(field);
  }
  const missing = missingFields.map((f) => `${f.path}${f.help ? ` — ${f.help}` : ''}`);
  const ready = missing.length === 0;
  return {
    file: 'profile.toml',
    ready,
    missing: [...missing],
    hint: ready
      ? `all ${REQUIRED_PROFILE_FIELDS.length} REQUIRED fields filled`
      : `run \`${currentBinaryName()} profile set <field> <value>\` for each missing field above`,
  };
}

// ---------------------------------------------------------------------------
// Resume content — total filled entries across experience / project /
// education / skills. Replaces the old "≥ 5 substantive lines in
// resume_pool.md" heuristic with a structural count.
// ---------------------------------------------------------------------------

function checkResumeContent(toml: ProfileToml): FileCheck {
  let count = 0;
  // Experience entries with at least a job_title or bullets count.
  for (const e of toml.experience) {
    if (isFilled(e.job_title) || isFilled(e.bullets)) count++;
  }
  for (const p of toml.project) {
    if (isFilled(p.name) || isFilled(p.bullets)) count++;
  }
  for (const e of toml.education) {
    if (isFilled(e.degree) || isFilled(e.school)) count++;
  }
  // Skills sub-fields each contribute 1 if filled.
  if (isFilled(toml.skills.languages)) count++;
  if (isFilled(toml.skills.frameworks)) count++;
  if (isFilled(toml.skills.tools)) count++;
  if (isFilled(toml.skills.domains)) count++;
  if (isFilled(toml.skills.free_text)) count++;

  const ready = count >= RESUME_MIN_ENTRIES;
  return {
    file: 'resume content',
    ready,
    missing: ready ? [] : [`only ${count} entries / skill groups (need ≥ ${RESUME_MIN_ENTRIES})`],
    hint: ready
      ? `${count} resume entries / skills groups`
      : `add experience / project / education entries via \`${currentBinaryName()} profile add experience\` and skills via \`${currentBinaryName()} profile set skills.<bucket>\``,
  };
}

// ---------------------------------------------------------------------------
// Stories + form answers — count filled builtin stories
// ---------------------------------------------------------------------------

function checkStoriesAndFormAnswers(toml: ProfileToml): FileCheck {
  const builtinIds = new Set(WOLF_BUILTIN_STORIES.map((s) => s.id));
  const answeredBuiltins = toml.story.filter(
    (s) => builtinIds.has(s.id) && isFilled(s.star_story),
  ).length;
  const total = WOLF_BUILTIN_STORIES.length;
  const ready = answeredBuiltins >= STORIES_MIN_ANSWERED;
  return {
    file: 'stories',
    ready,
    missing: ready ? [] : [`only ${answeredBuiltins} / ${total} builtin stories answered (need ≥ ${STORIES_MIN_ANSWERED})`],
    hint: ready
      ? `${answeredBuiltins} / ${total} builtin stories answered — fill more as you go`
      : `answer at least ${STORIES_MIN_ANSWERED} builtin prompts via \`${currentBinaryName()} profile set story.<id>.star_story <value>\``,
  };
}
