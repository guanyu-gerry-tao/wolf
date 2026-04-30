import { z } from 'zod';
import { parse as parseTomlText } from 'smol-toml';
import { WOLF_BUILTIN_STORIES } from './profileFields.js';

/**
 * Parser, validator, and shape for `profile.toml` (the v2 single-file profile).
 *
 * # Why everything is `.default('')`
 *
 * Schema-relevant string fields use multiline `"""..."""` syntax, so on
 * disk they're either filled (a real value, possibly with leading/trailing
 * newlines) or "empty" (just `\n` between the triple quotes). The
 * `isFilled()` helper trims and tells the difference. Zod treats them all
 * as optional with default `""` so:
 *
 *   - parsing a fresh wolf-init template doesn't blow up on missing
 *     fields the user hasn't touched yet,
 *   - parsing an older / partial / hand-edited profile.toml still
 *     succeeds — strict per-field requirements are enforced separately
 *     by `wolf doctor` (which uses `PROFILE_FIELDS`),
 *   - downstream TS consumers see `ProfileToml` as a fully-populated
 *     object (no `field?: string` noise everywhere).
 *
 * # Why arrays of tables (`[[experience]]` etc) parse as plain arrays
 *
 * smol-toml renders `[[xxx]]` arrays-of-tables into JS arrays of objects.
 * The schema mirrors that — `experience: z.array(ExperienceEntrySchema)`.
 *
 * # Lazy inject for builtin stories
 *
 * `[[story]]` entries shipped before the binary added new builtins are
 * missing those builtins. `injectMissingBuiltinStories` runs after parse
 * to top up the array. This avoids a `schema_version` bump every time
 * wolf adds a builtin prompt.
 */

// ---------------------------------------------------------------------------
// Multiline string field — every textual field on profile.toml is one of
// these. We don't enforce non-empty here; that's a doctor concern.
// ---------------------------------------------------------------------------
const MultilineString = z.string().default('');

// ---------------------------------------------------------------------------
// Per-table schemas. Each preserves the structure of the bundled template;
// any baseline field MUST appear here so a clean parse round-trips.
// ---------------------------------------------------------------------------

const ResumeSchema = z.object({
  section_order: MultilineString,
  note: MultilineString,
}).default({ section_order: '', note: '' });

const IdentitySchema = z.object({
  legal_first_name: MultilineString,
  legal_middle_name: MultilineString,
  legal_last_name: MultilineString,
  preferred_name: MultilineString,
  pronouns: MultilineString,
  date_of_birth: MultilineString,
  country_of_citizenship: MultilineString,
  country_currently_in: MultilineString,
  note: MultilineString,
}).default({} as never);

const ContactSchema = z.object({
  email: MultilineString,
  phone: MultilineString,
  note: MultilineString,
}).default({} as never);

const AddressSchema = z.object({
  full: MultilineString,
  note: MultilineString,
}).default({} as never);

const LinksSchema = z.object({
  first: MultilineString,
  second: MultilineString,
  others: MultilineString,
  note: MultilineString,
}).default({} as never);

const JobPreferencesSchema = z.object({
  target_roles: MultilineString,
  target_locations: MultilineString,
  remote_preference: MultilineString,
  relocation_within_metro: MultilineString,
  relocation_within_state: MultilineString,
  relocation_cross_country: MultilineString,
  relocation_international: MultilineString,
  relocation_free_text: MultilineString,
  sponsorship_h1b: MultilineString,
  sponsorship_green_card: MultilineString,
  sponsorship_cpt: MultilineString,
  sponsorship_opt: MultilineString,
  sponsorship_none: MultilineString,
  sponsorship_free_text: MultilineString,
  hard_reject_companies: MultilineString,
  precision_apply_companies: MultilineString,
  min_hourly_rate_usd: MultilineString,
  min_annual_salary_usd: MultilineString,
  scoring_notes: MultilineString,
  note: MultilineString,
}).default({} as never);

const DemographicsSchema = z.object({
  race: MultilineString,
  gender: MultilineString,
  ethnicity: MultilineString,
  veteran_status: MultilineString,
  disability_status: MultilineString,
  lgbtq: MultilineString,
  transgender: MultilineString,
  first_gen_college: MultilineString,
  note: MultilineString,
}).default({} as never);

const ClearanceSchema = z.object({
  has_active: MultilineString,
  level: MultilineString,
  status: MultilineString,
  willing_to_obtain: MultilineString,
  note: MultilineString,
}).default({} as never);

const FormAnswersSchema = z.object({
  authorized_to_work: MultilineString,
  require_sponsorship: MultilineString,
  willing_to_relocate: MultilineString,
  salary_expectation: MultilineString,
  how_did_you_hear: MultilineString,
  when_can_you_start: MultilineString,
  note: MultilineString,
}).default({} as never);

const DocumentsSchema = z.object({
  transcript: MultilineString,
  unofficial_transcript: MultilineString,
  reference_letter: MultilineString,
  portfolio_sample: MultilineString,
  note: MultilineString,
}).default({} as never);

const SkillsSchema = z.object({
  languages: MultilineString,
  frameworks: MultilineString,
  tools: MultilineString,
  domains: MultilineString,
  free_text: MultilineString,
}).default({} as never);

// Optional resume sections — same shape (items + note).
const ItemsSectionSchema = z.object({
  items: MultilineString,
  note: MultilineString,
}).default({} as never);

const InterestsSchema = z.object({
  free_text: MultilineString,
  note: MultilineString,
}).default({} as never);

// ---------------------------------------------------------------------------
// Array-of-table entries. `id` is REQUIRED at parse time — without an id
// the runner can't address the entry by `wolf profile set <type>.<id>.field`.
// All other fields default to ''.
// ---------------------------------------------------------------------------

const ExperienceEntrySchema = z.object({
  id: z.string().min(1),
  job_title: MultilineString,
  company: MultilineString,
  start: MultilineString,
  end: MultilineString,
  location: MultilineString,
  bullets: MultilineString,
  subnote: MultilineString,
});

const ProjectEntrySchema = z.object({
  id: z.string().min(1),
  name: MultilineString,
  year: MultilineString,
  tech_stack: MultilineString,
  bullets: MultilineString,
  subnote: MultilineString,
});

const EducationEntrySchema = z.object({
  id: z.string().min(1),
  degree: MultilineString,
  school: MultilineString,
  start: MultilineString,
  end: MultilineString,
  gpa: MultilineString,
  relevant_coursework: MultilineString,
  subnote: MultilineString,
});

const StoryEntrySchema = z.object({
  id: z.string().min(1),
  prompt: MultilineString,
  // wolf-managed flag; user shouldn't touch on builtins. Default false so
  // a malformed entry doesn't get auto-promoted to required-status.
  required: z.boolean().default(false),
  star_story: MultilineString,
  subnote: MultilineString,
});

// ---------------------------------------------------------------------------
// Top-level schema. `schemaVersion` is enforced strictly here (number)
// because the migrations runtime gates on it.
// ---------------------------------------------------------------------------

export const ProfileTomlSchema = z.object({
  schemaVersion: z.number().int().positive(),

  resume: ResumeSchema,
  identity: IdentitySchema,
  contact: ContactSchema,
  address: AddressSchema,
  links: LinksSchema,
  job_preferences: JobPreferencesSchema,
  demographics: DemographicsSchema,
  clearance: ClearanceSchema,
  form_answers: FormAnswersSchema,
  documents: DocumentsSchema,
  skills: SkillsSchema,

  awards: ItemsSectionSchema,
  publications: ItemsSectionSchema,
  patents: ItemsSectionSchema,
  hackathons: ItemsSectionSchema,
  open_source: ItemsSectionSchema,
  certifications: ItemsSectionSchema,
  languages_spoken: ItemsSectionSchema,
  volunteer: ItemsSectionSchema,
  interests: InterestsSchema,
  speaking: ItemsSectionSchema,

  experience: z.array(ExperienceEntrySchema).default([]),
  project: z.array(ProjectEntrySchema).default([]),
  education: z.array(EducationEntrySchema).default([]),
  story: z.array(StoryEntrySchema).default([]),
});

export type ProfileToml = z.infer<typeof ProfileTomlSchema>;
export type ExperienceEntry = z.infer<typeof ExperienceEntrySchema>;
export type ProjectEntry = z.infer<typeof ProjectEntrySchema>;
export type EducationEntry = z.infer<typeof EducationEntrySchema>;
export type StoryEntry = z.infer<typeof StoryEntrySchema>;

// ---------------------------------------------------------------------------
// Parse + lazy-inject pipeline
// ---------------------------------------------------------------------------

/**
 * Parses a TOML string into a typed `ProfileToml`. Applies zod defaults
 * for any missing baseline fields, then runs `injectMissingBuiltinStories`
 * to top up the [[story]] array with any builtins added since the file
 * was written.
 *
 * @throws on malformed TOML or schema-level type mismatches (e.g. an
 *   `[[experience]]` entry without `id`, or `schemaVersion = "two"`).
 */
export function parseProfileToml(text: string): ProfileToml {
  const obj = parseTomlText(text);
  const parsed = ProfileTomlSchema.parse(obj);
  return injectMissingBuiltinStories(parsed);
}

/**
 * Top-up: if any wolf-builtin story id from `WOLF_BUILTIN_STORIES` is
 * missing from `parsed.story`, append a stub. Preserves existing entries
 * (including custom ones) verbatim. Order: existing entries stay in their
 * original positions; missing builtins are appended in their wolf-defined
 * order.
 *
 * Why this exists: wolf releases can add new builtin prompts without a
 * `schemaVersion` bump (small, additive change). On first read after the
 * upgrade, missing builtins are surfaced. The next disk write (via
 * `wolf profile set` or migration) persists the topped-up shape.
 */
export function injectMissingBuiltinStories(parsed: ProfileToml): ProfileToml {
  const presentIds = new Set(parsed.story.map((s) => s.id));
  const missing = WOLF_BUILTIN_STORIES.filter((b) => !presentIds.has(b.id));
  if (missing.length === 0) return parsed;

  const appended: StoryEntry[] = missing.map((b) => ({
    id: b.id,
    prompt: b.prompt,
    required: b.required,
    star_story: '',
    subnote: '',
  }));

  return { ...parsed, story: [...parsed.story, ...appended] };
}

/**
 * Treats an empty / whitespace-only multiline string value as "not filled".
 * Used by doctor / AI-prompt builders to decide whether a field has user
 * content. The zod schema parses `"""\n\n"""` to `"\n"` (the literal
 * newline) — `isFilled` strips and checks length.
 */
export function isFilled(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Looks up a value by dot-path. Used by `wolf profile get` and the
 * surgical-edit tools that need to verify a path's value without re-parsing.
 *
 * Supported paths:
 *   - `<table>.<field>`             scalar table member (e.g. `contact.email`)
 *   - `<type>.<id>.<field>`         array-of-table member by id
 *                                   (e.g. `experience.amazon-2024.bullets`,
 *                                    `story.tell_me_about_failure.star_story`)
 *
 * Returns `undefined` for unknown paths or missing array members.
 */
export function getByPath(profile: ProfileToml, dotPath: string): string | boolean | number | undefined {
  const parts = dotPath.split('.');
  if (parts.length === 2) {
    // Top-level scalar table member.
    const [table, field] = parts;
    const tableObj = (profile as unknown as Record<string, unknown>)[table];
    if (tableObj === undefined || tableObj === null || typeof tableObj !== 'object') return undefined;
    const value = (tableObj as Record<string, unknown>)[field];
    if (value === undefined) return undefined;
    if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
    return undefined;
  }
  if (parts.length === 3) {
    // Array-of-table member: e.g. `experience.<id>.<field>`.
    const [arrayName, id, field] = parts;
    const list = (profile as unknown as Record<string, unknown>)[arrayName];
    if (!Array.isArray(list)) return undefined;
    const entry = (list as Array<Record<string, unknown>>).find((e) => e.id === id);
    if (entry === undefined) return undefined;
    const value = entry[field];
    if (value === undefined) return undefined;
    if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
    return undefined;
  }
  return undefined;
}
