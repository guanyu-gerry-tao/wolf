import { ALL_JOB_STATUSES } from './types/job.js';
import { TIER_NAMES } from './scoringTiers.js';

/**
 * Wolf-defined metadata for every editable field on a job row. Drives:
 *
 *   - `wolf job fields`          — prints field reference
 *   - `wolf job set` validation  — rejects unknown names; coerces the raw
 *                                  CLI string to the field's runtime type
 *
 * # What's enumerated
 *
 * Only **user-editable** fields. System-managed fields (`id`, `companyId`,
 * `createdAt`, `updatedAt`) are excluded — `wolf job show` still prints
 * them, but they're not in this list and `wolf job set createdAt …` is
 * refused at the application boundary.
 *
 * # Job vs Profile
 *
 * Profile fields are nested (`identity.email`); job fields are flat
 * (single column). So `name` here is a plain field name, not a dot-path.
 * The `description_md` field is special — it's stored in a SQLite column
 * but accessed via `JobRepository.readJdText` / `writeJdText` rather than
 * `update`.
 *
 * # Why this is hardcoded TS, not derived from the SQLite schema
 *
 * Same reason as PROFILE_FIELDS: the SQL columns don't carry help text,
 * required-ness, or which subset is user-editable. Hardcoding here keeps
 * the metadata grep-discoverable and trivially diffable.
 */

export type JobFieldType =
  | 'string'             // non-empty single-line string
  | 'multilineString'    // long-form prose (description_md, scoreJustification)
  | 'number'             // numeric, e.g. score 0..1, salaryLow / salaryHigh
  | 'boolean'            // 'true'/'false', 'yes'/'no', '1'/'0'
  | 'enum'               // one of `enumValues`
  | 'nullableString'     // string OR empty/'null' for null
  | 'nullableEnum'       // enum OR empty/'null' for null
  | 'nullableTier';      // tier name (skip / mass_apply / tailor / invest)
                         // OR stringified index (0..3) OR empty/'null' for null

export interface JobFieldMeta {
  /** Field name — plain SQL column or special `description_md`. */
  name: string;
  type: JobFieldType;
  /** Required at row creation. `wolf job set` accepts unsetting only for
   *  nullable types; required + non-null fields refuse '' / 'null'. */
  required: boolean;
  /** Short user-facing description — surfaced by `wolf job fields`. */
  help: string;
  /** Allowed values for `enum` / `nullableEnum`. Coercion rejects others. */
  enumValues?: ReadonlyArray<string>;
}

const SOURCE_VALUES = ['LinkedIn', 'Indeed', 'handshake', 'Company website', 'Other'] as const;

const SPONSORSHIP_VALUES = [
  'unknown',
  'no sponsorship',
  'Green card',
  'Work visa',
  'OPT',
  'CPT',
] as const;

const ERROR_VALUES = [
  'score_extraction_error',
  'score_error',
  'tailor_resume_error',
  'tailor_cover_letter_error',
  'tailor_compile_error',
  'fill_detection_error',
  'fill_submit_error',
  'reach_contact_error',
  'reach_draft_error',
  'reach_send_error',
] as const;

export const JOB_FIELDS: ReadonlyArray<JobFieldMeta> = [
  // ---- core identity (mostly set by `wolf add` / `wolf hunt`)
  { name: 'title',                       type: 'string',           required: true,  help: 'Role title (e.g. "Software Engineer Intern").' },
  { name: 'url',                         type: 'string',           required: true,  help: 'Application or listing URL.' },
  { name: 'source',                      type: 'enum',             required: true,  help: 'Where wolf found the job.', enumValues: SOURCE_VALUES },
  { name: 'location',                    type: 'string',           required: true,  help: 'Office location for the role.' },
  { name: 'remote',                      type: 'boolean',          required: true,  help: 'Whether the role is remote.' },

  // ---- optional pay / requirements
  // β.10j/k: salary range, both plain numbers in USD.
  //   IMPORTANT: 0 = explicitly unpaid (real signal); blank = unknown.
  //   The pair carries no constraint — `low=0` + `high=30000` is valid
  //   (unpaid base + bonus ceiling). Coercion does not validate the pair.
  { name: 'salaryLow',                   type: 'number',           required: false, help: 'Lower bound of annual USD. Use 0 for unpaid (explicit). Blank = unknown / not listed by JD.' },
  { name: 'salaryHigh',                  type: 'number',           required: false, help: 'Upper bound of annual USD. Blank if single-point comp or unknown. Allowed even when salaryLow is 0 (e.g. unpaid base + bonus).' },
  { name: 'workAuthorizationRequired',   type: 'enum',             required: true,  help: 'Sponsorship stance per JD. Use unknown when the JD does not state it.', enumValues: SPONSORSHIP_VALUES },
  { name: 'clearanceRequired',           type: 'boolean',          required: true,  help: 'Whether the role requires a security clearance.' },

  // ---- AI score (v3 tier model)
  // `score` is deprecated since v3 — kept for backward-compat with existing
  // workspaces. New code uses `tierAi` / `tierUser` instead.
  { name: 'score',                       type: 'number',           required: false, help: '[deprecated] Numeric score 0.0..1.0 from v1; superseded by tierAi.' },
  { name: 'scoreJustification',          type: 'multilineString',  required: false, help: 'AI-generated markdown evaluation (## Tier / ## Pros / ## Cons sections).' },
  { name: 'tierAi',                      type: 'nullableTier',     required: false, help: `AI tier verdict, one of: ${TIER_NAMES.join(' / ')}. Blank = unscored. Set by 'wolf score'.` },
  { name: 'tierUser',                    type: 'nullableTier',     required: false, help: `Manual tier override; blank = no override. Set by 'wolf job set tier' / cleared by 'wolf job unlock'. AI never overwrites this.` },

  // ---- pipeline state
  { name: 'status',                      type: 'enum',             required: true,  help: 'Pipeline status.', enumValues: ALL_JOB_STATUSES },
  { name: 'error',                       type: 'nullableEnum',     required: false, help: 'Set when status is "error"; otherwise blank.', enumValues: ERROR_VALUES },
  { name: 'appliedProfileId',            type: 'nullableString',   required: false, help: 'Profile dirname used to apply; blank = not yet applied.' },

  // ---- artifact existence flags (set by tailor / fill / reach; paths
  //      themselves are convention-derived via JobRepository.getArtifactPath)
  { name: 'hasTailoredResume',           type: 'boolean',          required: false, help: 'Whether tailor has produced resume.pdf. Default false; set true by tailor.' },
  { name: 'hasTailoredCoverLetter',      type: 'boolean',          required: false, help: 'Whether tailor has produced cover_letter.html + cover_letter.pdf.' },
  { name: 'hasScreenshots',              type: 'boolean',          required: false, help: 'Whether fill has recorded the screenshots/ directory.' },
  { name: 'hasOutreachDraft',            type: 'boolean',          required: false, help: 'Whether reach has drafted outreach.eml.' },

  // ---- JD prose (lives in jobs.description_md SQLite column)
  { name: 'description_md',              type: 'multilineString',  required: false, help: 'Full JD prose. Use --from-file for long content.' },
];

/** Fast lookup. */
export const JOB_FIELDS_BY_NAME: ReadonlyMap<string, JobFieldMeta> = new Map(
  JOB_FIELDS.map((f) => [f.name, f]),
);

/** System-managed fields — listed by `wolf job show` but rejected by
 *  `wolf job set`. Kept as a separate const so the rejection logic and
 *  the show output don't drift. */
export const JOB_SYSTEM_FIELDS: ReadonlyArray<string> = [
  'id',
  'companyId',
  'createdAt',
  'updatedAt',
];
