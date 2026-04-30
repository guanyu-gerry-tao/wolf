/**
 * Wolf-defined metadata for every field in `profile.toml`. Drives:
 *
 *   - `wolf profile fields`                — prints field reference for
 *                                            humans / AI
 *   - `wolf doctor`                        — flags REQUIRED fields whose
 *                                            value is empty
 *   - `wolf profile set` validation        — rejects unknown paths
 *
 * # Hardcoded, not derived from the template
 *
 * Reviewer feedback: build-time-deriving the schema from template comments
 * is fragile (regex-based comment parsing breaks on language drift, and
 * comments are also user-editable so they'd silently rot). Hardcoded TS
 * tables are type-safe, IDE-jumpable, and trivially diffable in PRs.
 *
 * A unit test pins the alignment between `PROFILE_FIELDS` and the
 * actual paths present in the bundled profile.toml template — both
 * directions, so adding a field to one without the other fails CI.
 *
 * # Path conventions
 *
 * - Top-level scalar:                   `<table>.<field>`
 * - Top-level scalar in a single-table: same shape (`identity.email`).
 * - Array-of-table member's field:      `<type>.<id>.<field>`
 *                                       (e.g. `experience.amazon-2024.bullets`,
 *                                        `story.tell_me_about_failure.star_story`)
 * - File-level (no leading `[table]`):  `<field>` directly. None today.
 *
 * # Fields NOT enumerated here
 *
 * Per-array-entry fields (experience.<id>.*, project.<id>.*,
 * education.<id>.*, story.<id>.*) are NOT in this list — there's no
 * sensible "path" to enumerate when we don't know the ids ahead of time.
 * Their per-field metadata lives in their dedicated table (`STORY_FIELDS`,
 * `EXPERIENCE_FIELDS`, etc., added when the corresponding command lands).
 */
export interface FieldMeta {
  /** Dot-path identifier — exactly what `wolf profile set <path>` accepts. */
  path: string;
  required: boolean;
  type: 'multilineString' | 'scalar';
  /** Short user-facing description — what this field is and why it matters. */
  help: string;
}

export const PROFILE_FIELDS: ReadonlyArray<FieldMeta> = [
  // ---- resume layout
  { path: 'resume.section_order',                required: false, type: 'multilineString', help: 'Order of resume sections (one section name per line). Blank = tailor default.' },
  { path: 'resume.note',                         required: false, type: 'multilineString', help: 'Free-form notes about resume preferences.' },

  // ---- identity
  { path: 'identity.legal_first_name',           required: true,  type: 'multilineString', help: 'Used as the resume header.' },
  { path: 'identity.legal_middle_name',          required: false, type: 'multilineString', help: 'Leave blank if none.' },
  { path: 'identity.legal_last_name',            required: true,  type: 'multilineString', help: 'Used as the resume header.' },
  { path: 'identity.preferred_name',             required: false, type: 'multilineString', help: 'Leave blank to use legal first name on outreach.' },
  { path: 'identity.pronouns',                   required: false, type: 'multilineString', help: '' },
  { path: 'identity.date_of_birth',              required: false, type: 'multilineString', help: 'Required by some non-US ATS forms; YYYY-MM-DD.' },
  { path: 'identity.country_of_citizenship',     required: true,  type: 'multilineString', help: 'Country whose passport you hold. Fact, not strategy.' },
  { path: 'identity.country_currently_in',       required: false, type: 'multilineString', help: 'Where you are physically right now. Defaults to United States.' },
  { path: 'identity.note',                       required: false, type: 'multilineString', help: 'Identity-related notes / "small thoughts".' },

  // ---- contact
  { path: 'contact.email',                       required: true,  type: 'multilineString', help: 'Resume header & outreach From: address.' },
  { path: 'contact.phone',                       required: true,  type: 'multilineString', help: 'Resume header.' },
  { path: 'contact.note',                        required: false, type: 'multilineString', help: '' },

  // ---- address
  { path: 'address.full',                        required: true,  type: 'multilineString', help: 'Complete address including country.' },
  { path: 'address.note',                        required: false, type: 'multilineString', help: '' },

  // ---- links
  { path: 'links.first',                         required: true,  type: 'multilineString', help: 'At minimum your LinkedIn. Wolf infers link type from the URL.' },
  { path: 'links.second',                        required: false, type: 'multilineString', help: '' },
  { path: 'links.others',                        required: false, type: 'multilineString', help: 'Additional URLs, one per line.' },
  { path: 'links.note',                          required: false, type: 'multilineString', help: '' },

  // ---- job preferences
  { path: 'job_preferences.target_roles',        required: true,  type: 'multilineString', help: 'One role per line (markdown bullets).' },
  { path: 'job_preferences.target_locations',    required: true,  type: 'multilineString', help: 'One location per line.' },
  { path: 'job_preferences.remote_preference',   required: false, type: 'multilineString', help: '"remote only" / "hybrid only" / "onsite only" / "no preference" (default).' },
  { path: 'job_preferences.relocation_within_metro',     required: false, type: 'multilineString', help: 'HONEST: "yes" / "no" / "maybe".' },
  { path: 'job_preferences.relocation_within_state',     required: false, type: 'multilineString', help: 'HONEST: "yes" / "no" / "maybe".' },
  { path: 'job_preferences.relocation_cross_country',    required: false, type: 'multilineString', help: 'HONEST: "yes" / "no" / "maybe".' },
  { path: 'job_preferences.relocation_international',    required: false, type: 'multilineString', help: 'HONEST: "yes" / "no" / "maybe".' },
  { path: 'job_preferences.relocation_free_text',        required: false, type: 'multilineString', help: 'Free-form relocation notes.' },
  { path: 'job_preferences.sponsorship_h1b',             required: false, type: 'multilineString', help: 'STRATEGY: "yes" / "no" / "only if no other option" / "NA".' },
  { path: 'job_preferences.sponsorship_green_card',      required: false, type: 'multilineString', help: 'STRATEGY: "yes" / "no" / "only if no other option" / "NA".' },
  { path: 'job_preferences.sponsorship_cpt',             required: false, type: 'multilineString', help: 'STRATEGY: "yes" / "no" / "only if no other option" / "NA".' },
  { path: 'job_preferences.sponsorship_opt',             required: false, type: 'multilineString', help: 'STRATEGY: "yes" / "no" / "only if no other option" / "NA".' },
  { path: 'job_preferences.sponsorship_none',            required: false, type: 'multilineString', help: 'STRATEGY: "yes" / "no" / "only if no other option" / "NA".' },
  { path: 'job_preferences.sponsorship_free_text',       required: false, type: 'multilineString', help: 'Free-form sponsorship notes.' },
  { path: 'job_preferences.hard_reject_companies',       required: false, type: 'multilineString', help: 'Companies to never recommend, one per line.' },
  { path: 'job_preferences.precision_apply_companies',   required: false, type: 'multilineString', help: 'Companies wolf tailors but does not auto-fill (you apply manually).' },
  { path: 'job_preferences.min_hourly_rate_usd',         required: false, type: 'multilineString', help: 'Intern role floor in USD; blank for none.' },
  { path: 'job_preferences.min_annual_salary_usd',       required: false, type: 'multilineString', help: 'NG role floor in USD; blank for none.' },
  { path: 'job_preferences.scoring_notes',               required: false, type: 'multilineString', help: 'Free-form preferences for the AI scorer.' },
  { path: 'job_preferences.note',                        required: false, type: 'multilineString', help: 'Job-search "small thoughts".' },

  // ---- demographics (all OPTIONAL by US EEO law)
  { path: 'demographics.race',                   required: false, type: 'multilineString', help: 'OPTIONAL EEO.' },
  { path: 'demographics.gender',                 required: false, type: 'multilineString', help: 'OPTIONAL EEO.' },
  { path: 'demographics.ethnicity',              required: false, type: 'multilineString', help: 'OPTIONAL EEO. "Hispanic or Latino" / "Not Hispanic or Latino" / "Decline to answer".' },
  { path: 'demographics.veteran_status',         required: false, type: 'multilineString', help: 'OPTIONAL EEO.' },
  { path: 'demographics.disability_status',      required: false, type: 'multilineString', help: 'OPTIONAL EEO.' },
  { path: 'demographics.lgbtq',                  required: false, type: 'multilineString', help: 'OPTIONAL.' },
  { path: 'demographics.transgender',            required: false, type: 'multilineString', help: 'OPTIONAL.' },
  { path: 'demographics.first_gen_college',      required: false, type: 'multilineString', help: 'OPTIONAL: "Yes" / "No" / "Decline to answer".' },
  { path: 'demographics.note',                   required: false, type: 'multilineString', help: '' },

  // ---- clearance
  { path: 'clearance.has_active',                required: false, type: 'multilineString', help: '"Yes" / "No". Default "No".' },
  { path: 'clearance.level',                     required: false, type: 'multilineString', help: 'Only fill if active: Secret / Top Secret / TS-SCI.' },
  { path: 'clearance.status',                    required: false, type: 'multilineString', help: 'Only fill if active: Active / Inactive / Eligible.' },
  { path: 'clearance.willing_to_obtain',         required: false, type: 'multilineString', help: '"Yes" / "No".' },
  { path: 'clearance.note',                      required: false, type: 'multilineString', help: '' },

  // ---- form_answers (verbatim values for ATS forms)
  { path: 'form_answers.authorized_to_work',     required: true,  type: 'multilineString', help: 'Verbatim form answer (e.g. "Yes, I am authorized to work in the United States.").' },
  { path: 'form_answers.require_sponsorship',    required: true,  type: 'multilineString', help: 'Verbatim form answer.' },
  { path: 'form_answers.willing_to_relocate',    required: true,  type: 'multilineString', help: 'Verbatim form answer.' },
  { path: 'form_answers.salary_expectation',     required: false, type: 'multilineString', help: 'Default in template; edit if you want a different stance.' },
  { path: 'form_answers.how_did_you_hear',       required: false, type: 'multilineString', help: 'Default "LinkedIn"; edit per usual answer.' },
  { path: 'form_answers.when_can_you_start',     required: false, type: 'multilineString', help: 'Default "Available immediately".' },
  { path: 'form_answers.note',                   required: false, type: 'multilineString', help: '' },

  // ---- documents
  { path: 'documents.transcript',                required: false, type: 'multilineString', help: 'Bare filename inside attachments/; blank if none.' },
  { path: 'documents.unofficial_transcript',     required: false, type: 'multilineString', help: 'Bare filename inside attachments/.' },
  { path: 'documents.reference_letter',          required: false, type: 'multilineString', help: 'Bare filename inside attachments/.' },
  { path: 'documents.portfolio_sample',          required: false, type: 'multilineString', help: 'Bare filename inside attachments/.' },
  { path: 'documents.note',                      required: false, type: 'multilineString', help: '' },

  // ---- skills
  { path: 'skills.languages',                    required: false, type: 'multilineString', help: 'Programming languages.' },
  { path: 'skills.frameworks',                   required: false, type: 'multilineString', help: '' },
  { path: 'skills.tools',                        required: false, type: 'multilineString', help: '' },
  { path: 'skills.domains',                      required: false, type: 'multilineString', help: '' },
  { path: 'skills.free_text',                    required: false, type: 'multilineString', help: 'Skills not fitting the buckets above.' },

  // ---- optional resume sections
  { path: 'awards.items',                        required: false, type: 'multilineString', help: 'Awards & honors, one per line.' },
  { path: 'awards.note',                         required: false, type: 'multilineString', help: '' },
  { path: 'publications.items',                  required: false, type: 'multilineString', help: '' },
  { path: 'publications.note',                   required: false, type: 'multilineString', help: '' },
  { path: 'patents.items',                       required: false, type: 'multilineString', help: '' },
  { path: 'patents.note',                        required: false, type: 'multilineString', help: '' },
  { path: 'hackathons.items',                    required: false, type: 'multilineString', help: '' },
  { path: 'hackathons.note',                     required: false, type: 'multilineString', help: '' },
  { path: 'open_source.items',                   required: false, type: 'multilineString', help: '' },
  { path: 'open_source.note',                    required: false, type: 'multilineString', help: '' },
  { path: 'certifications.items',                required: false, type: 'multilineString', help: '' },
  { path: 'certifications.note',                 required: false, type: 'multilineString', help: '' },
  { path: 'languages_spoken.items',              required: false, type: 'multilineString', help: 'Spoken languages with proficiency.' },
  { path: 'languages_spoken.note',               required: false, type: 'multilineString', help: '' },
  { path: 'volunteer.items',                     required: false, type: 'multilineString', help: '' },
  { path: 'volunteer.note',                      required: false, type: 'multilineString', help: '' },
  { path: 'interests.free_text',                 required: false, type: 'multilineString', help: 'Brief and genuine.' },
  { path: 'interests.note',                      required: false, type: 'multilineString', help: '' },
  { path: 'speaking.items',                      required: false, type: 'multilineString', help: 'Conference talks, panels, podcasts.' },
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
