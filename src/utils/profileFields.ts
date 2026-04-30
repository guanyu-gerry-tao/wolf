/**
 * Wolf-defined metadata for every field in `profile.toml`. Single source of
 * truth for:
 *
 *   - `wolf profile fields`                — prints field reference for
 *                                            humans / AI
 *   - `wolf doctor`                        — flags REQUIRED fields whose
 *                                            value is empty
 *   - `wolf profile set` validation        — rejects unknown paths
 *   - `profileTomlTemplate` codegen        — `src/utils/profileTomlGenerate.ts`
 *                                            renders the bundled profile.toml
 *   - `profileTomlRender.ts` renderers     — drive `## heading` loops via
 *                                            the `section` + `heading` fields.
 *   - `wolf context --for=search`          — drives field selection via
 *                                            `inSearchContext`.
 *
 * # Why this is the source of truth
 *
 * Editing one entry — say flipping a field's `inSearchContext` to true —
 * automatically updates: the bundled init template, `wolf profile fields`
 * listing, doctor's required-set, the markdown renderers, AND the search
 * context bundle. No hand-maintained mirror in 5 places.
 *
 * # Path conventions
 *
 * - Top-level scalar:                   `<table>.<field>`
 * - Array-of-table member's field:      `<type>.<id>.<field>`
 *                                       (e.g. `experience.amazon-2024.bullets`,
 *                                        `story.tell_me_about_failure.star_story`)
 *
 * # Fields NOT enumerated here
 *
 * Per-array-entry fields (experience.<id>.*, project.<id>.*,
 * education.<id>.*, story.<id>.*) are NOT in this list — there's no
 * sensible "path" to enumerate when we don't know the ids ahead of time.
 * Their per-field metadata, when needed, lives next to the array
 * generator (e.g. WOLF_BUILTIN_STORIES below for stories).
 */

/** Which renderer in `profileTomlRender.ts` owns this field's loop emission.
 *  Fields with no `section` are skipped by every renderer loop — typically
 *  because they participate in a combined cross-field view (relocation /
 *  sponsorship matrices) or are file-level only (resume.section_order). */
export type FieldSection =
  | 'profile_md'              // identity / contact / address / links /
                              // job_preferences / demographics / clearance
  | 'resume_pool_optional'    // awards / publications / hackathons / etc.
  | 'standard_questions';     // form_answers / documents

export interface FieldMeta {
  /** Dot-path identifier — exactly what `wolf profile set <path>` accepts. */
  path: string;
  required: boolean;
  type: 'multilineString' | 'scalar';
  /** Short user-facing description — what this field is and why it matters.
   *  Surfaced by `wolf profile fields`. */
  help: string;
  /** Single-line `# comment` rendered above the field in profile.toml. Empty
   *  string = no comment line. Keep it ONE line — the generator does not wrap. */
  comment?: string;
  /** Optional non-empty default written between the triple quotes when the
   *  template is generated. Defaults to '' (= empty multiline string). */
  defaultValue?: string;
  /** Human-facing label used by EVERY downstream renderer (profile_md,
   *  resume_pool, standard_questions, search context). One label fits all
   *  contexts — search context just shows fewer fields, not different names. */
  heading?: string;
  /** Which markdown renderer's loop emits this field. Undefined = no
   *  renderer emits it via loop (combined-view fields, file-level fields,
   *  pure-storage fields like *.note that go through collectNotes). */
  section?: FieldSection;
  /** True if this field appears in `wolf context --for=search`. The search
   *  bundle is the privacy-sensitive one — only enable for fields that
   *  affect job filtering / scoring (job_preferences, clearance). NEVER
   *  enable for identity / contact / demographics / form_answers. */
  inSearchContext?: boolean;
}

export const PROFILE_FIELDS: ReadonlyArray<FieldMeta> = [
  // ---- resume layout
  { path: 'resume.section_order',                required: false, type: 'multilineString', help: 'Order of resume sections (one section name per line). Blank = tailor default.',
    comment: 'OPTIONAL — Order of sections on your generated resume. One section name per line as a markdown bullet. Leave empty to let tailor pick a default. Allowed: experience, project, education, skills, awards, publications, patents, hackathons, open_source, certifications, languages_spoken, volunteer, interests, speaking.' },
  { path: 'resume.note',                         required: false, type: 'multilineString', help: 'Free-form notes about resume preferences.' },

  // ---- identity
  { path: 'identity.legal_first_name',           required: true,  type: 'multilineString', help: 'Used as the resume header.',
    comment: 'REQUIRED — Wolf cannot guess this. Used as the resume header.',
    heading: 'Legal first name', section: 'profile_md' },
  { path: 'identity.legal_middle_name',          required: false, type: 'multilineString', help: 'Leave blank if none.',
    comment: 'OPTIONAL — Leave blank if none.',
    heading: 'Legal middle name', section: 'profile_md' },
  { path: 'identity.legal_last_name',            required: true,  type: 'multilineString', help: 'Used as the resume header.',
    comment: 'REQUIRED — Wolf cannot guess this. Used as the resume header.',
    heading: 'Legal last name', section: 'profile_md' },
  { path: 'identity.preferred_name',             required: false, type: 'multilineString', help: 'Leave blank to use legal first name on outreach.',
    comment: 'OPTIONAL — Leave blank to use legal first name on outreach.',
    heading: 'Preferred name', section: 'profile_md' },
  { path: 'identity.pronouns',                   required: false, type: 'multilineString', help: '',
    heading: 'Pronouns', section: 'profile_md' },
  { path: 'identity.date_of_birth',              required: false, type: 'multilineString', help: 'Required by some non-US ATS forms; YYYY-MM-DD.',
    comment: 'OPTIONAL — Required by some non-US ATS forms; format YYYY-MM-DD.',
    heading: 'Date of birth', section: 'profile_md' },
  { path: 'identity.country_of_citizenship',     required: true,  type: 'multilineString', help: 'Country whose passport you hold. Fact, not strategy.',
    comment: 'REQUIRED — Country whose passport you hold (e.g. "United States", "China", "India"). Fact, not strategy.',
    heading: 'Country of citizenship', section: 'profile_md' },
  { path: 'identity.country_currently_in',       required: false, type: 'multilineString', help: 'Where you are physically right now. Defaults to United States.',
    comment: 'OPTIONAL — Where you are physically right now. Defaults to United States; update if you are abroad.',
    defaultValue: 'United States',
    heading: "Country you're currently in", section: 'profile_md' },
  // identity.note: collected by collectNotes(); not emitted by any renderer loop.
  { path: 'identity.note',                       required: false, type: 'multilineString', help: 'Identity-related notes / "small thoughts".' },

  // ---- contact
  { path: 'contact.email',                       required: true,  type: 'multilineString', help: 'Resume header & outreach From: address.',
    comment: 'REQUIRED — Resume header & outreach From: address.',
    heading: 'Email', section: 'profile_md' },
  { path: 'contact.phone',                       required: true,  type: 'multilineString', help: 'Resume header.',
    comment: 'REQUIRED — Resume header.',
    heading: 'Phone', section: 'profile_md' },
  { path: 'contact.note',                        required: false, type: 'multilineString', help: '' },

  // ---- address
  { path: 'address.full',                        required: true,  type: 'multilineString', help: 'Complete address including country.',
    comment: 'REQUIRED — Complete address including country, e.g. "123 Main St, Apt 4, San Francisco, CA 94102, USA".',
    heading: 'Full address', section: 'profile_md' },
  { path: 'address.note',                        required: false, type: 'multilineString', help: '' },

  // ---- links
  { path: 'links.first',                         required: true,  type: 'multilineString', help: 'At minimum your LinkedIn. Wolf infers link type from the URL.',
    comment: 'REQUIRED — At minimum your LinkedIn. Wolf infers link type (LinkedIn / GitHub / portfolio / LeetCode) from the URL.',
    heading: 'First link (most prominent on resume)', section: 'profile_md' },
  { path: 'links.second',                        required: false, type: 'multilineString', help: '',
    heading: "Second link (also on resume if there's room)", section: 'profile_md' },
  { path: 'links.others',                        required: false, type: 'multilineString', help: 'Additional URLs, one per line.',
    comment: 'OPTIONAL — additional URLs, one per line (markdown bullet style).',
    heading: 'Other links', section: 'profile_md' },
  { path: 'links.note',                          required: false, type: 'multilineString', help: '' },

  // ---- job preferences
  { path: 'job_preferences.target_roles',        required: true,  type: 'multilineString', help: 'One role per line (markdown bullets).',
    comment: 'REQUIRED — one role per line as markdown bullets, e.g. "- Software Engineer".',
    heading: 'Target roles', section: 'profile_md', inSearchContext: true },
  { path: 'job_preferences.target_locations',    required: true,  type: 'multilineString', help: 'One location per line.',
    comment: 'REQUIRED — one location per line, e.g. "- SF Bay Area", "- NYC", "- Remote-US".',
    heading: 'Target locations', section: 'profile_md', inSearchContext: true },
  { path: 'job_preferences.remote_preference',   required: false, type: 'multilineString', help: '"remote only" / "hybrid only" / "onsite only" / "no preference" (default).',
    comment: 'OPTIONAL — "remote only" / "hybrid only" / "onsite only" / "no preference" (default).',
    defaultValue: 'no preference',
    heading: 'Remote preference', section: 'profile_md', inSearchContext: true },
  // Relocation: ONE freeform field. The previous design had 5 fields (4
  // pseudo-enum yes/no/maybe + 1 free_text) but no consumer ever read them
  // structurally — every reader (tailor / search context / score) hands
  // the value to an AI as prose. Collapsing keeps fidelity (the user can
  // write "maybe, depends on COL" instead of being forced into yes/no/maybe)
  // and lets `renderProfileMarkdown` drop its combined-view hack.
  { path: 'job_preferences.relocation_preferences',      required: false, type: 'multilineString', help: 'Free-form relocation appetite. Cover scope (metro / state / cross-country / international) and any caveats.',
    comment: 'OPTIONAL — Free-form. Honest answers about relocation appetite for hunt filtering. Cover scope (metro / state / cross-country / international) and any caveats.',
    heading: 'Relocation preferences', section: 'profile_md', inSearchContext: true },
  // Sponsorship: same collapse rationale as relocation.
  { path: 'job_preferences.sponsorship_preferences',     required: false, type: 'multilineString', help: 'Free-form sponsorship strategy. Which jobs you are willing to apply to (H-1B / green card / CPT / OPT / no-sponsorship-only).',
    comment: 'OPTIONAL — Free-form. Sponsorship strategy: which jobs you are willing to apply to. Mention H-1B / green card / CPT / OPT / no-sponsorship-only and any conditions.',
    heading: 'Sponsorship preferences', section: 'profile_md', inSearchContext: true },
  { path: 'job_preferences.hard_reject_companies',       required: false, type: 'multilineString', help: 'Companies to never recommend, one per line.',
    comment: 'OPTIONAL — companies to never recommend (one per line, markdown bullets).',
    heading: 'Hard-reject companies (NEVER recommend)', section: 'profile_md', inSearchContext: true },
  { path: 'job_preferences.precision_apply_companies',   required: false, type: 'multilineString', help: 'Companies wolf tailors but does not auto-fill (you apply manually).',
    comment: 'OPTIONAL — companies wolf should still tailor for but NOT auto-fill (you apply manually). One per line, markdown bullets.',
    heading: 'Precision-apply companies (recommend, but flag manual-apply)', section: 'profile_md', inSearchContext: true },
  { path: 'job_preferences.min_hourly_rate_usd',         required: false, type: 'multilineString', help: 'Intern role floor in USD; blank for none.',
    comment: 'OPTIONAL — minimum hourly rate in USD (intern role floor); blank for no floor.',
    heading: 'Minimum hourly rate (intern, USD)', section: 'profile_md', inSearchContext: true },
  { path: 'job_preferences.min_annual_salary_usd',       required: false, type: 'multilineString', help: 'NG role floor in USD; blank for none.',
    comment: 'OPTIONAL — minimum annual salary in USD (NG role floor); blank for no floor.',
    heading: 'Minimum annual salary (new grad, USD)', section: 'profile_md', inSearchContext: true },
  { path: 'job_preferences.scoring_notes',               required: false, type: 'multilineString', help: 'Free-form preferences for the AI scorer.',
    heading: 'Scoring notes', section: 'profile_md', inSearchContext: true },
  // job_preferences.note: special "User notes" heading inside Job Preferences H1.
  { path: 'job_preferences.note',                        required: false, type: 'multilineString', help: 'Job-search "small thoughts".',
    heading: 'User notes', section: 'profile_md' },

  // ---- demographics (all OPTIONAL by US EEO law)
  { path: 'demographics.race',                   required: false, type: 'multilineString', help: 'OPTIONAL EEO.',
    heading: 'Race', section: 'profile_md' },
  { path: 'demographics.gender',                 required: false, type: 'multilineString', help: 'OPTIONAL EEO.',
    heading: 'Gender', section: 'profile_md' },
  { path: 'demographics.ethnicity',              required: false, type: 'multilineString', help: 'OPTIONAL EEO. "Hispanic or Latino" / "Not Hispanic or Latino" / "Decline to answer".',
    heading: 'Ethnicity', section: 'profile_md' },
  { path: 'demographics.veteran_status',         required: false, type: 'multilineString', help: 'OPTIONAL EEO.',
    defaultValue: 'I am not a protected veteran',
    heading: 'Veteran status', section: 'profile_md' },
  { path: 'demographics.disability_status',      required: false, type: 'multilineString', help: 'OPTIONAL EEO.',
    heading: 'Disability status', section: 'profile_md' },
  { path: 'demographics.lgbtq',                  required: false, type: 'multilineString', help: 'OPTIONAL.',
    heading: 'LGBTQ+', section: 'profile_md' },
  { path: 'demographics.transgender',            required: false, type: 'multilineString', help: 'OPTIONAL.',
    heading: 'Transgender', section: 'profile_md' },
  { path: 'demographics.first_gen_college',      required: false, type: 'multilineString', help: 'OPTIONAL: "Yes" / "No" / "Decline to answer".',
    defaultValue: 'No',
    heading: 'First-generation college student', section: 'profile_md' },
  { path: 'demographics.note',                   required: false, type: 'multilineString', help: '' },

  // ---- clearance: same collapse rationale. 4 pseudo-enum fields → 1 freeform.
  // Note: form fill writes verbatim ATS answers from `form_answers.*`, NOT
  // from clearance.has_active etc. — so collapsing here doesn't break fill.
  { path: 'clearance.preferences',               required: false, type: 'multilineString', help: 'Free-form. Whether you hold an active clearance, level / status if so, and willingness to obtain one.',
    comment: 'OPTIONAL — Free-form. Whether you hold an active clearance (Secret / TS / TS-SCI), its current status (Active / Inactive / Eligible), and your willingness to obtain one if not.',
    heading: 'Clearance preferences', section: 'profile_md', inSearchContext: true },
  { path: 'clearance.note',                      required: false, type: 'multilineString', help: '' },

  // ---- form_answers (verbatim values for ATS forms)
  { path: 'form_answers.authorized_to_work',     required: true,  type: 'multilineString', help: 'Verbatim form answer (e.g. "Yes, I am authorized to work in the United States.").',
    comment: 'REQUIRED — verbatim form answer (e.g. "Yes, I am authorized to work in the United States."). Strategic preference (which jobs to apply to) lives in [job_preferences].sponsorship_*.',
    heading: 'Form answer — Are you authorized to work?', section: 'standard_questions' },
  { path: 'form_answers.require_sponsorship',    required: true,  type: 'multilineString', help: 'Verbatim form answer.',
    comment: 'REQUIRED — verbatim form answer.',
    heading: 'Form answer — Do you require sponsorship?', section: 'standard_questions' },
  { path: 'form_answers.willing_to_relocate',    required: true,  type: 'multilineString', help: 'Verbatim form answer.',
    comment: 'REQUIRED — verbatim form answer.',
    heading: 'Form answer — Are you willing to relocate?', section: 'standard_questions' },
  { path: 'form_answers.salary_expectation',     required: false, type: 'multilineString', help: 'Default in template; edit if you want a different stance.',
    comment: 'OPTIONAL — default below; edit if you want a different stance.',
    defaultValue: 'Open to discuss based on the full compensation package and role scope.',
    heading: "What's your salary expectation?", section: 'standard_questions' },
  { path: 'form_answers.how_did_you_hear',       required: false, type: 'multilineString', help: 'Default "LinkedIn"; edit per usual answer.',
    defaultValue: 'LinkedIn',
    heading: 'How did you hear about us?', section: 'standard_questions' },
  { path: 'form_answers.when_can_you_start',     required: false, type: 'multilineString', help: 'Default "Available immediately".',
    defaultValue: 'Available immediately',
    heading: 'When can you start?', section: 'standard_questions' },
  { path: 'form_answers.note',                   required: false, type: 'multilineString', help: '' },

  // ---- documents
  { path: 'documents.transcript',                required: false, type: 'multilineString', help: 'Bare filename inside attachments/; blank if none.',
    heading: 'Transcript', section: 'standard_questions' },
  { path: 'documents.unofficial_transcript',     required: false, type: 'multilineString', help: 'Bare filename inside attachments/.',
    heading: 'Unofficial transcript', section: 'standard_questions' },
  { path: 'documents.reference_letter',          required: false, type: 'multilineString', help: 'Bare filename inside attachments/.',
    heading: 'Reference letter', section: 'standard_questions' },
  { path: 'documents.portfolio_sample',          required: false, type: 'multilineString', help: 'Bare filename inside attachments/.',
    heading: 'Portfolio sample', section: 'standard_questions' },
  { path: 'documents.note',                      required: false, type: 'multilineString', help: '' },

  // ---- skills (combined into one "## Skills" body block, not loop-emitted)
  { path: 'skills.languages',                    required: false, type: 'multilineString', help: 'Programming languages.',
    comment: 'Comma- or newline-separated; wolf reformats per JD.' },
  { path: 'skills.frameworks',                   required: false, type: 'multilineString', help: '' },
  { path: 'skills.tools',                        required: false, type: 'multilineString', help: '' },
  { path: 'skills.domains',                      required: false, type: 'multilineString', help: '' },
  { path: 'skills.free_text',                    required: false, type: 'multilineString', help: 'Skills not fitting the buckets above.' },

  // ---- optional resume sections
  { path: 'awards.items',                        required: false, type: 'multilineString', help: 'Awards & honors, one per line.',
    heading: 'Awards & Honors', section: 'resume_pool_optional' },
  { path: 'awards.note',                         required: false, type: 'multilineString', help: '' },
  { path: 'publications.items',                  required: false, type: 'multilineString', help: '',
    heading: 'Publications', section: 'resume_pool_optional' },
  { path: 'publications.note',                   required: false, type: 'multilineString', help: '' },
  { path: 'patents.items',                       required: false, type: 'multilineString', help: '',
    heading: 'Patents', section: 'resume_pool_optional' },
  { path: 'patents.note',                        required: false, type: 'multilineString', help: '' },
  { path: 'hackathons.items',                    required: false, type: 'multilineString', help: '',
    heading: 'Hackathons', section: 'resume_pool_optional' },
  { path: 'hackathons.note',                     required: false, type: 'multilineString', help: '' },
  { path: 'open_source.items',                   required: false, type: 'multilineString', help: '',
    heading: 'Open Source', section: 'resume_pool_optional' },
  { path: 'open_source.note',                    required: false, type: 'multilineString', help: '' },
  { path: 'certifications.items',                required: false, type: 'multilineString', help: '',
    heading: 'Certifications', section: 'resume_pool_optional' },
  { path: 'certifications.note',                 required: false, type: 'multilineString', help: '' },
  { path: 'languages_spoken.items',              required: false, type: 'multilineString', help: 'Spoken languages with proficiency.',
    heading: 'Languages', section: 'resume_pool_optional' },
  { path: 'languages_spoken.note',               required: false, type: 'multilineString', help: '' },
  { path: 'volunteer.items',                     required: false, type: 'multilineString', help: '',
    heading: 'Volunteer', section: 'resume_pool_optional' },
  { path: 'volunteer.note',                      required: false, type: 'multilineString', help: '' },
  { path: 'interests.free_text',                 required: false, type: 'multilineString', help: 'Brief and genuine.',
    heading: 'Interests', section: 'resume_pool_optional' },
  { path: 'interests.note',                      required: false, type: 'multilineString', help: '' },
  { path: 'speaking.items',                      required: false, type: 'multilineString', help: 'Conference talks, panels, podcasts.',
    heading: 'Speaking', section: 'resume_pool_optional' },
  { path: 'speaking.note',                       required: false, type: 'multilineString', help: '' },
];

/** Fast lookup by path. */
export const PROFILE_FIELDS_BY_PATH: ReadonlyMap<string, FieldMeta> = new Map(
  PROFILE_FIELDS.map((f) => [f.path, f]),
);

/** REQUIRED subset, for `wolf doctor` and `wolf profile fields --required`. */
export const REQUIRED_PROFILE_FIELDS: ReadonlyArray<FieldMeta> = PROFILE_FIELDS.filter(
  (f) => f.required,
);

// ===========================================================================
// Wolf-builtin behavioral story prompts
// ===========================================================================
//
// `WOLF_BUILTIN_STORIES` is the registry of behavioral interview prompts
// wolf seeds into every freshly-initialized profile.toml. Stories whose
// `id` appears in this list are **wolf-builtin** — `wolf profile remove
// story <id>` refuses to delete them (clear `star_story` to skip),
// `wolf profile set story.<id>.prompt` and `.required` refuse to edit
// them (those fields are wolf-defined). Stories with ids NOT in this set
// are user-custom and get standard add/remove/set semantics.
//
// # Lazy inject
//
// When wolf reads profile.toml and finds a builtin id missing from the
// `[[story]]` array (older binary didn't seed it), `injectMissingBuiltinStories`
// in profileToml.ts appends a stub entry on next write. New builtins do
// NOT require a schema_version bump.
//
// # Why this lives in profileFields.ts (not its own file)
//
// Stories share the array-of-tables shape with experience / project /
// education; the only structural difference is that wolf has a registry
// of "managed entries" for stories and not for the others. That registry
// is metadata about the profile schema — same kind as PROFILE_FIELDS —
// so it lives here.

export interface BuiltinStory {
  id: string;
  prompt: string;
  required: boolean;
}

export const WOLF_BUILTIN_STORIES: ReadonlyArray<BuiltinStory> = [
  { id: 'tell_me_about_yourself',          prompt: 'Tell me about yourself',                                                  required: true  },
  { id: 'tell_me_about_failure',           prompt: 'Tell me about a time you failed',                                         required: true  },
  { id: 'tell_me_about_conflict',          prompt: 'Tell me about a time you faced conflict',                                 required: true  },
  { id: 'biggest_strength',                prompt: 'Biggest strength',                                                        required: true  },
  { id: 'biggest_weakness',                prompt: "Biggest weakness (with what you're doing about it)",                      required: true  },
  { id: 'five_year_goal',                  prompt: 'Where do you see yourself in 5 years?',                                   required: true  },
  { id: 'why_leaving_current_role',        prompt: 'Why are you leaving your current role?',                                  required: false },
  { id: 'handle_stress_failure',           prompt: 'How do you handle stress / failure?',                                     required: true  },
  { id: 'what_motivates',                  prompt: 'What motivates you?',                                                     required: true  },
  { id: 'led_team_or_project',             prompt: 'Describe a time you led a team or project',                               required: true  },
  { id: 'handled_disagreed_feedback',      prompt: 'Describe a time you handled feedback you disagreed with',                 required: true  },
  { id: 'management_style',                prompt: 'What is your management style?',                                          required: false },
  { id: 'proudest_project',                prompt: "Tell me about a project you're proud of",                                 required: true  },
  { id: 'view_company_framework',          prompt: 'How do you view our company? — your framework',                          required: true  },
  { id: 'view_product_framework',          prompt: 'How do you view our product? — your framework',                          required: true  },
  { id: 'suggestions_company_framework',   prompt: 'What suggestions do you have for our company? — your framework',         required: true  },
  { id: 'suggestions_product_framework',   prompt: 'What suggestions do you have for our product? — your framework',         required: true  },
];

/** Fast lookup: is this id a wolf-builtin? Used by command handlers to
 *  reject `wolf profile remove story <id>` / `set story.<id>.prompt` etc. */
export const WOLF_BUILTIN_STORY_IDS: ReadonlySet<string> = new Set(
  WOLF_BUILTIN_STORIES.map((s) => s.id),
);
