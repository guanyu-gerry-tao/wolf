import path from 'node:path';
import { readFile, writeFile, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import BetterSqlite3 from 'better-sqlite3';
import { stripComments } from '../../utils/stripComments.js';
import { extractH2Content } from '../../utils/extractH2.js';
import {
  setMultilineString,
  setMultilineStringInArrayMember,
  appendArrayMember,
} from '../../utils/tomlEdit.js';
import { WOLF_BUILTIN_STORIES, WOLF_BUILTIN_STORY_IDS } from '../../utils/storyFields.js';
import profileTomlTemplate from '../../application/impl/templates/profile.toml';
import { log } from '../../utils/logger.js';
import type { Migration } from './index.js';

/**
 * v1 → v2 migration: three markdown files → single profile.toml.
 *
 * # What this does, in one paragraph
 *
 * For every profile directory under `profiles/<name>/`, this migration
 * reads `profile.md` + `resume_pool.md` + `standard_questions.md`,
 * backs them up under `.wolf/backups/v1/profiles-<name>/`, then writes a
 * `profile.toml` synthesised from the bundled v2 template with values
 * surgically filled in from the old markdown content. The old `.md` files
 * are deleted after a successful write.
 *
 * # Why best-effort, not perfect
 *
 * - Profile.md → TOML mapping is precise (every old H2 has a known v2
 *   destination).
 * - standard_questions.md → [[story]] is precise BY ID — if the old H2
 *   text matches a wolf-builtin prompt verbatim, its body lands as
 *   `star_story`. Any old H2 that isn't a builtin is logged as a warning
 *   and dropped (β.1 doesn't yet support custom stories).
 * - resume_pool.md → [[experience]] / [[project]] / [[education]] /
 *   [skills] is intentionally coarse: the old format had free-form H3
 *   entries with bullets that we'd have to hand-parse; instead, this
 *   migration dumps each top-level H2 section's body as one [[<type>]]
 *   entry with id="legacy" and the body as its bullets. Users refine
 *   manually after migration.
 *
 * # Why hard-cut, not transactional
 *
 * Pre-1.0 user base is small and the runner contract documents the
 * recovery path (".wolf/backups/v1/"). Building rollback / partial-state
 * recovery would dwarf the migration logic itself. If anything fails
 * mid-run, schemaVersion stays at v1 and the user restores their backup
 * before retrying.
 */
export const v1ToV2: Migration = {
  fromVersion: 1,
  toVersion: 2,
  description: 'Profile: 3 .md files → profile.toml. Jobs: jd.md disk files → ' +
               'description_md SQLite column. Backups under .wolf/backups/v1/.',
  run: async (workspaceDir: string) => {
    // 1. Profile-side migration (per profile dir).
    const profilesDir = path.join(workspaceDir, 'profiles');
    const profileNames = await listProfileDirs(profilesDir);
    if (profileNames.length > 0) {
      for (const name of profileNames) {
        log.info('migrate.v1tov2.profile.start', { profile: name });
        await migrateOneProfile(workspaceDir, name);
        log.info('migrate.v1tov2.profile.done', { profile: name });
      }
    } else {
      log.info('migrate.v1tov2.no_profiles_found', { workspaceDir });
    }

    // 2. Jobs-side migration: ALTER TABLE adds `description_md` (handled
    // idempotently in initializeSchema; here we just iterate every existing
    // job dir and fill the column from the on-disk jd.md, then archive the
    // file). Skips silently if the workspace has no SQLite db yet.
    await migrateJobsJdToColumn(workspaceDir);
  },
};

// ---------------------------------------------------------------------------
// Profile-directory enumeration
// ---------------------------------------------------------------------------

/** Returns the names of subdirectories under `profilesDir`, or [] if missing. */
async function listProfileDirs(profilesDir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(profilesDir, { withFileTypes: true });
  } catch {
    // Workspace was never initialized with any profile — nothing to migrate.
    return [];
  }
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/** Returns the file's UTF-8 content, or null if it doesn't exist. */
async function readIfExists(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-profile migration pipeline
// ---------------------------------------------------------------------------

async function migrateOneProfile(workspaceDir: string, name: string): Promise<void> {
  const profileDir = path.join(workspaceDir, 'profiles', name);

  const profileMd = await readIfExists(path.join(profileDir, 'profile.md'));
  const resumePoolMd = await readIfExists(path.join(profileDir, 'resume_pool.md'));
  const standardQuestionsMd = await readIfExists(path.join(profileDir, 'standard_questions.md'));

  // If profile.toml already exists (rerun, partial migration), bail loudly
  // rather than overwrite — the user is in an unexpected state and should
  // either restore from backup or remove the .toml manually.
  const tomlPath = path.join(profileDir, 'profile.toml');
  if (await fileExists(tomlPath)) {
    throw new Error(
      `Profile '${name}' already has a profile.toml at ${tomlPath}. ` +
      `Migration v1→v2 refuses to overwrite. If you need to re-run, ` +
      `restore the v1 .md files from .wolf/backups/v1/profiles-${name}/ ` +
      `and remove the profile.toml manually.`,
    );
  }

  // 1. Back up the old .md files. We always create the backup directory
  // even if all three files are missing (for predictable manual-rollback
  // behaviour: presence of the dir signals "v1→v2 migration ran here").
  const backupDir = path.join(workspaceDir, '.wolf', 'backups', 'v1', `profiles-${name}`);
  await mkdir(backupDir, { recursive: true });
  if (profileMd !== null) {
    await writeFile(path.join(backupDir, 'profile.md'), profileMd, 'utf-8');
  }
  if (resumePoolMd !== null) {
    await writeFile(path.join(backupDir, 'resume_pool.md'), resumePoolMd, 'utf-8');
  }
  if (standardQuestionsMd !== null) {
    await writeFile(path.join(backupDir, 'standard_questions.md'), standardQuestionsMd, 'utf-8');
  }

  // 2. Synthesize the new profile.toml content from the template, then
  // surgically fill in known fields from the old content.
  let toml = profileTomlTemplate;
  if (profileMd !== null) {
    toml = applyProfileMdMappings(toml, profileMd);
  }
  if (standardQuestionsMd !== null) {
    toml = applyStandardQuestionsMappings(toml, standardQuestionsMd, name);
  }
  if (resumePoolMd !== null) {
    toml = applyResumePoolMappings(toml, resumePoolMd);
  }

  // 3. Atomically write the new profile.toml. We don't fsync; SQLite's
  // existing wolf.toml save uses the same fs.writeFile convention.
  await writeFile(tomlPath, toml, 'utf-8');

  // 4. Delete the old .md files. Keep the backup intact at .wolf/backups/.
  if (profileMd !== null) {
    await unlink(path.join(profileDir, 'profile.md'));
  }
  if (resumePoolMd !== null) {
    await unlink(path.join(profileDir, 'resume_pool.md'));
  }
  if (standardQuestionsMd !== null) {
    await unlink(path.join(profileDir, 'standard_questions.md'));
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// profile.md → profile.toml field mappings
// ---------------------------------------------------------------------------

/** (H2 text in old profile.md) → (TOML table, field) destination. */
const PROFILE_MD_MAP: ReadonlyArray<[string, string, string]> = [
  // [Old H2 name, TOML table, TOML field]
  ['Legal first name',           'identity', 'legal_first_name'],
  ['Legal middle name',          'identity', 'legal_middle_name'],
  ['Legal last name',            'identity', 'legal_last_name'],
  ['Preferred name',             'identity', 'preferred_name'],
  ['Pronouns',                   'identity', 'pronouns'],
  ['Date of birth',              'identity', 'date_of_birth'],
  ['Country of citizenship',     'identity', 'country_of_citizenship'],
  ["Country you're currently in", 'identity', 'country_currently_in'],

  ['Email',                      'contact',  'email'],
  ['Phone',                      'contact',  'phone'],

  ['Full address',               'address',  'full'],

  ['First link (most prominent on resume)',          'links',    'first'],
  ['Second link (also on resume if there\'s room)',  'links',    'second'],
  ['Other links',                                    'links',    'others'],

  ['Target roles',                                                                'job_preferences', 'target_roles'],
  ['Target locations',                                                            'job_preferences', 'target_locations'],
  ['Relocation preference — where are you actually willing to live?',             'job_preferences', 'relocation_free_text'],
  ['Scoring notes',                                                               'job_preferences', 'scoring_notes'],
  ["Precision-apply companies (don't mass-apply)",                                'job_preferences', 'precision_apply_companies'],
  ['Hard-reject companies (never apply, even if AI suggests)',                    'job_preferences', 'hard_reject_companies'],
  ['Sponsorship preference — which jobs do you want to apply to?',                'job_preferences', 'sponsorship_free_text'],
  ['Minimum hourly rate (intern, USD)',                                           'job_preferences', 'min_hourly_rate_usd'],
  ['Minimum annual salary (new grad, USD)',                                       'job_preferences', 'min_annual_salary_usd'],
  ['Remote preference',                                                           'job_preferences', 'remote_preference'],
  // 'Max applications per day' was DROPPED from v2 schema — content is lost.

  ['Race',                              'demographics', 'race'],
  ['Gender',                            'demographics', 'gender'],
  ['Ethnicity',                         'demographics', 'ethnicity'],
  ['Veteran status',                    'demographics', 'veteran_status'],
  ['Disability status',                 'demographics', 'disability_status'],
  ['LGBTQ+',                            'demographics', 'lgbtq'],
  ['Transgender',                       'demographics', 'transgender'],
  ['First-generation college student',  'demographics', 'first_gen_college'],

  ['Do you have an active security clearance?', 'clearance', 'has_active'],
  ['Clearance level',                            'clearance', 'level'],
  ['Clearance status',                           'clearance', 'status'],
  ['Are you willing to obtain one?',             'clearance', 'willing_to_obtain'],
];

/**
 * For each (oldH2, table, field) in PROFILE_MD_MAP, extract the H2 body
 * from the old `profile.md` and surgical-write it into the corresponding
 * TOML field. Empty / whitespace-only bodies are skipped (the TOML
 * already has the empty-template default).
 */
function applyProfileMdMappings(toml: string, profileMd: string): string {
  const stripped = stripComments(profileMd);
  let result = toml;
  for (const [oldH2, table, field] of PROFILE_MD_MAP) {
    const raw = extractH2Content(stripped, oldH2);
    const body = joinH2Body(raw);
    if (!body) continue;
    try {
      result = setMultilineString(result, table, field, body);
    } catch (err) {
      log.warn('migrate.v1tov2.profile_md.field_skipped', {
        oldH2,
        table,
        field,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// standard_questions.md → [form_answers] + [[story]]
// ---------------------------------------------------------------------------

/** Old short-answer / form-answer H2s that map to scalar [form_answers] fields. */
const STANDARD_QUESTIONS_FORM_MAP: ReadonlyArray<[string, string]> = [
  // [Old H2 name, form_answers field]
  ["What's your salary expectation?",                     'salary_expectation'],
  ['How did you hear about us?',                          'how_did_you_hear'],
  ['When can you start?',                                 'when_can_you_start'],
  ['Form answer — Are you authorized to work?',           'authorized_to_work'],
  ['Form answer — Do you require sponsorship?',           'require_sponsorship'],
  ['Form answer — Are you willing to relocate?',          'willing_to_relocate'],
];

/** Old behavioural-story H2s mapped to wolf-builtin story ids. Verbatim
 *  H2 text — case-sensitive — must match a row here to land in story.<id>. */
const STANDARD_QUESTIONS_STORY_MAP: ReadonlyArray<[string, string]> = [
  // [Old H2 name, builtin story id]
  ['Tell me about yourself',                                                    'tell_me_about_yourself'],
  ['Tell me about a time you failed',                                           'tell_me_about_failure'],
  ['Tell me about a time you faced conflict',                                   'tell_me_about_conflict'],
  ['Biggest strength',                                                          'biggest_strength'],
  ["Biggest weakness (with what you're doing about it)",                        'biggest_weakness'],
  ['Where do you see yourself in 5 years?',                                     'five_year_goal'],
  ['Why are you leaving your current role?',                                    'why_leaving_current_role'],
  ['How do you handle stress / failure?',                                       'handle_stress_failure'],
  ['What motivates you?',                                                       'what_motivates'],
  ['Describe a time you led a team or project',                                 'led_team_or_project'],
  ['Describe a time you handled feedback you disagreed with',                   'handled_disagreed_feedback'],
  ['What is your management style?',                                            'management_style'],
  ["Tell me about a project you're proud of",                                   'proudest_project'],
  ['How do you view our company? — your framework',                             'view_company_framework'],
  ['How do you view our product? — your framework',                             'view_product_framework'],
  ['What suggestions do you have for our company? — your framework',            'suggestions_company_framework'],
  ['What suggestions do you have for our product? — your framework',            'suggestions_product_framework'],
];

function applyStandardQuestionsMappings(
  toml: string,
  standardQuestionsMd: string,
  profileName: string,
): string {
  const stripped = stripComments(standardQuestionsMd);
  let result = toml;

  // Form answers (scalar table fields).
  for (const [oldH2, field] of STANDARD_QUESTIONS_FORM_MAP) {
    const raw = extractH2Content(stripped, oldH2);
    const body = joinH2Body(raw);
    if (!body) continue;
    try {
      result = setMultilineString(result, 'form_answers', field, body);
    } catch (err) {
      log.warn('migrate.v1tov2.std_q.form_answer_skipped', {
        oldH2, field, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Stories (array members keyed by builtin id).
  for (const [oldH2, storyId] of STANDARD_QUESTIONS_STORY_MAP) {
    if (!WOLF_BUILTIN_STORY_IDS.has(storyId)) {
      // Defensive: a stale entry in STANDARD_QUESTIONS_STORY_MAP that no
      // longer maps to a real builtin would silently swallow user content.
      // Log loudly.
      log.error('migrate.v1tov2.std_q.unknown_builtin_story_id', { storyId });
      continue;
    }
    const raw = extractH2Content(stripped, oldH2);
    const body = joinH2Body(raw);
    if (!body) continue;
    try {
      result = setMultilineStringInArrayMember(result, 'story', storyId, 'star_story', body);
    } catch (err) {
      log.warn('migrate.v1tov2.std_q.story_skipped', {
        oldH2, storyId, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Detect and warn about any old H2s that don't map to either form_answers
  // or a builtin story. Per plan, β doesn't yet support user-custom stories,
  // so these are logged + dropped.
  const knownH2s = new Set([
    ...STANDARD_QUESTIONS_FORM_MAP.map(([h2]) => h2),
    ...STANDARD_QUESTIONS_STORY_MAP.map(([h2]) => h2),
  ]);
  for (const oldH2 of listAllH2s(stripped)) {
    if (!knownH2s.has(oldH2)) {
      log.warn('migrate.v1tov2.std_q.unmapped_h2_dropped', {
        profile: profileName,
        oldH2,
        hint: 'β does not yet support user-custom stories. Content lost; restore from .wolf/backups/v1/ and re-add manually if needed.',
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// resume_pool.md → [[experience]] / [[project]] / [[education]] / [skills] / etc.
// ---------------------------------------------------------------------------

/**
 * Coarse mapping: each top-level H2 section's body becomes one entry in
 * the corresponding TOML array (or a scalar field for [skills] / [interests]).
 * Per-H3 parsing of resume_pool.md was rejected as too fragile — users
 * tidy up after the migration.
 */
const RESUME_POOL_MAP: ReadonlyArray<{ h2: string; arrayName?: string; tableField?: [string, string]; legacyId?: string; bulletsField?: string }> = [
  { h2: 'Experience',          arrayName: 'experience', legacyId: 'legacy-experience', bulletsField: 'bullets' },
  { h2: 'Projects',            arrayName: 'project',    legacyId: 'legacy-projects',   bulletsField: 'bullets' },
  { h2: 'Education',           arrayName: 'education',  legacyId: 'legacy-education',  bulletsField: 'relevant_coursework' },
  { h2: 'Skills',              tableField: ['skills', 'free_text'] },
  { h2: 'Certifications',      tableField: ['certifications', 'items'] },
  { h2: 'Awards & Honors',     tableField: ['awards', 'items'] },
  { h2: 'Publications',        tableField: ['publications', 'items'] },
  { h2: 'Patents',             tableField: ['patents', 'items'] },
  { h2: 'Hackathons',          tableField: ['hackathons', 'items'] },
  { h2: 'Open Source',         tableField: ['open_source', 'items'] },
  { h2: 'Languages',           tableField: ['languages_spoken', 'items'] },
  { h2: 'Volunteer',           tableField: ['volunteer', 'items'] },
  { h2: 'Interests',           tableField: ['interests', 'free_text'] },
  { h2: 'Speaking',            tableField: ['speaking', 'items'] },
];

function applyResumePoolMappings(toml: string, resumePoolMd: string): string {
  const stripped = stripComments(resumePoolMd);
  let result = toml;

  for (const entry of RESUME_POOL_MAP) {
    const raw = extractH2Content(stripped, entry.h2);
    const body = joinH2Body(raw);
    if (!body) continue;

    if (entry.tableField) {
      const [table, field] = entry.tableField;
      try {
        result = setMultilineString(result, table, field, body);
      } catch (err) {
        log.warn('migrate.v1tov2.pool.skipped', {
          h2: entry.h2, table, field, error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (entry.arrayName && entry.legacyId && entry.bulletsField) {
      // Append a single legacy entry. job_title / company / start / end /
      // location / subnote stay empty; user tidies up. Use empty placeholders
      // for required-by-schema fields (they're parser-required for `id` only;
      // others are MultilineString defaulting to '').
      const block = makeLegacyArrayBlock(entry.arrayName, entry.legacyId, entry.bulletsField, body);
      result = appendArrayMember(result, block);
    }
  }

  return result;
}

/** Builds a `[[<arrayName>]]` block string with a stable legacy id and
 *  the given body crammed into the entry's bullets field. */
function makeLegacyArrayBlock(arrayName: string, legacyId: string, bulletsField: string, body: string): string {
  // We populate the minimum-required fields per schema. All other
  // multiline-string fields (job_title, company, start, end, location,
  // subnote, etc.) default to '' on parse. We emit them explicitly with
  // empty bodies for round-trip cleanliness. Per-array shapes are known.
  const fields: Record<string, string[]> = {
    experience: ['job_title', 'company', 'start', 'end', 'location', 'subnote'],
    project: ['name', 'year', 'tech_stack', 'subnote'],
    education: ['degree', 'school', 'start', 'end', 'gpa', 'subnote'],
  };
  const otherFields = fields[arrayName] ?? [];
  const lines: string[] = [
    `[[${arrayName}]]`,
    `id = "${legacyId}"`,
  ];
  for (const f of otherFields) {
    lines.push(`${f} = """`, '', '"""');
  }
  // The bullets / relevant_coursework field carries the migrated body.
  lines.push(`${bulletsField} = """`, body, '"""');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------

/** Trim an extractH2Content() return into a clean paragraph. The helper
 *  itself already trims, but we re-trim defensively in case future
 *  changes loosen its contract. Empty / whitespace-only inputs → ''. */
function joinH2Body(body: string): string {
  return body.replace(/^\s+|\s+$/g, '');
}

/** Returns every H2 heading text (sans leading '## ') in `md`. */
function listAllH2s(md: string): string[] {
  const out: string[] = [];
  for (const line of md.split('\n')) {
    const m = /^##\s+(.*?)\s*$/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

/** Re-export the WOLF_BUILTIN_STORIES shape for migration's reference —
 *  ensures the migration's hard-coded id list stays in sync at code-review
 *  time (any new builtin needs an entry in STANDARD_QUESTIONS_STORY_MAP
 *  too, otherwise migration would orphan its old answers). */
export const _migrationBuiltinSentinel = WOLF_BUILTIN_STORIES;

// ---------------------------------------------------------------------------
// jobs jd.md → description_md column
// ---------------------------------------------------------------------------

/**
 * For every per-job directory under `data/jobs/<dir>/`, reads the legacy
 * `jd.md` file (if present), backs it up to `.wolf/backups/v1/jobs/`,
 * writes its content into the `description_md` column for the matching
 * SQLite job row, and deletes the original file. Skips silently if the
 * workspace has no `data/wolf.sqlite` yet (fresh init, no jobs added).
 *
 * The ALTER TABLE that adds the column is handled in `initializeSchema`
 * (idempotent via try/catch on the duplicate-column error). This function
 * only handles data migration.
 *
 * Job rows are matched to their on-disk dir via the dir-name suffix:
 * `data/jobs/<company>_<title>_<jobIdShort>/`. We walk the dirs, parse
 * the trailing 8-char id-prefix, and look up the matching job row by
 * `id LIKE '<prefix>%'`. If a dir has no matching DB row (orphan), we
 * leave its jd.md alone and log a warning so the user can investigate.
 */
async function migrateJobsJdToColumn(workspaceDir: string): Promise<void> {
  const sqlitePath = path.join(workspaceDir, 'data', 'wolf.sqlite');
  if (!(await fileExists(sqlitePath))) {
    log.info('migrate.v1tov2.jobs.no_db_found', { workspaceDir });
    return;
  }
  const jobsDir = path.join(workspaceDir, 'data', 'jobs');
  if (!(await fileExists(jobsDir))) {
    log.info('migrate.v1tov2.jobs.no_jobs_dir', { workspaceDir });
    return;
  }

  const dirEntries = await readdir(jobsDir, { withFileTypes: true });
  const jobDirs = dirEntries.filter((e) => e.isDirectory()).map((e) => e.name);

  const backupRoot = path.join(workspaceDir, '.wolf', 'backups', 'v1', 'jobs');
  await mkdir(backupRoot, { recursive: true });

  // Open the SQLite file directly here. The migration framework runs with a
  // workspaceDir argument, not a Drizzle context, so we don't have the
  // app-context's connection. better-sqlite3 is a sync API which keeps the
  // migration code simple (and there's only one in flight at a time).
  const db = new BetterSqlite3(sqlitePath);
  // Make sure the column exists (initializeSchema's idempotent ALTER also
  // runs this; safe to attempt twice).
  try {
    db.prepare(`ALTER TABLE jobs ADD COLUMN description_md TEXT NOT NULL DEFAULT ''`).run();
  } catch {
    /* column already present */
  }

  const findByIdPrefix = db.prepare<[string], { id: string }>(
    `SELECT id FROM jobs WHERE id LIKE ? || '%' LIMIT 1`,
  );
  const updateDescription = db.prepare<[string, string, string]>(
    `UPDATE jobs SET description_md = ?, updated_at = ? WHERE id = ?`,
  );

  try {
    for (const dirName of jobDirs) {
      const dirPath = path.join(jobsDir, dirName);
      const jdMdPath = path.join(dirPath, 'jd.md');
      if (!(await fileExists(jdMdPath))) continue;

      const jdText = await readFile(jdMdPath, 'utf-8');
      // Extract the id prefix from the dir name suffix
      // (`<company>_<title>_<idPrefix>`). Older code used 8 chars.
      const idPrefixMatch = dirName.match(/_([a-f0-9]{8})$/i);
      if (!idPrefixMatch) {
        log.warn('migrate.v1tov2.jobs.dir_id_unparseable', { dirName });
        continue;
      }
      const idPrefix = idPrefixMatch[1];
      const row = findByIdPrefix.get(idPrefix);
      if (!row) {
        log.warn('migrate.v1tov2.jobs.orphan_dir', {
          dirName,
          hint: 'no matching jobs.id row; jd.md left in place',
        });
        continue;
      }

      // Backup → write column → unlink original.
      await writeFile(path.join(backupRoot, `${row.id}.jd.md`), jdText, 'utf-8');
      updateDescription.run(jdText, new Date().toISOString(), row.id);
      await unlink(jdMdPath);
      log.info('migrate.v1tov2.jobs.row.done', { jobId: row.id, dirName });
    }
  } finally {
    db.close();
  }
}
