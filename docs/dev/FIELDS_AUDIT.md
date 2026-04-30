# Fields audit

Snapshot of every wolf-defined field for review. Generated from
`src/utils/profileFields.ts`, `src/utils/profileToml.ts`, and
`src/utils/jobFields.ts` as of commit `8266082`.

Use this to decide which fields to keep / collapse / split / rename.
After review, edits land on the source files (this doc is review-only,
not a code source-of-truth).

Conventions in the tables below:
- **Type** — `multilineString` means stored between TOML triple quotes;
  no enum / type enforcement at parse time. `enum` / `boolean` / `number`
  / `salary` mean real type coercion via `coerceFieldValue` (jobs only).
- **Required** — REQ if `wolf doctor` flags it when empty; OPT otherwise.
- **Default** — `(empty)` means no default seeded in template.
- **In search ctx** — appears in `wolf context --for=search` bundle.
- **Section** — which renderer's `## H2` loop emits it (profile_md =
  tailor-context profile.md mirror; resume_pool_optional = resume pool
  optional sections; standard_questions = form_answers + documents).
  `(skip)` means no renderer loop emits it (used for `*.note` paths
  that go through `collectNotes`, or skills sub-fields combined into one
  body block).

---

## 1. Profile — flat tables (PROFILE_FIELDS, 56 entries)

All `multilineString`. None of these have type enforcement at parse —
help text is advisory only. Total: 56 fields.

### 1.1 `[resume]` — resume layout

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `resume.section_order` | OPT | (empty) | (skip) | Order of resume sections. One section name per line as bullets. Allowed: experience / project / education / skills / awards / publications / patents / hackathons / open_source / certifications / languages_spoken / volunteer / interests / speaking. Blank = tailor default. |
| `resume.note` | OPT | (empty) | (skip — collectNotes) | Free-form notes about resume preferences. |

### 1.2 `[identity]`

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `identity.legal_first_name` | **REQ** | (empty) | Legal first name | Used as the resume header. |
| `identity.legal_middle_name` | OPT | (empty) | Legal middle name | Leave blank if none. |
| `identity.legal_last_name` | **REQ** | (empty) | Legal last name | Used as the resume header. |
| `identity.preferred_name` | OPT | (empty) | Preferred name | Leave blank to use legal first name on outreach. |
| `identity.pronouns` | OPT | (empty) | Pronouns | — |
| `identity.date_of_birth` | OPT | (empty) | Date of birth | YYYY-MM-DD. Required by some non-US ATS forms. |
| `identity.country_of_citizenship` | **REQ** | (empty) | Country of citizenship | Country whose passport you hold. Fact, not strategy. |
| `identity.country_currently_in` | OPT | `United States` | Country you're currently in | Where you are physically right now. Update if abroad. |
| `identity.note` | OPT | (empty) | (skip — collectNotes) | Identity-related notes / "small thoughts". |

### 1.3 `[contact]`

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `contact.email` | **REQ** | (empty) | Email | Resume header & outreach From: address. |
| `contact.phone` | **REQ** | (empty) | Phone | Resume header. |
| `contact.note` | OPT | (empty) | (skip — collectNotes) | — |

### 1.4 `[address]`

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `address.full` | **REQ** | (empty) | Full address | Complete address including country. |
| `address.note` | OPT | (empty) | (skip — collectNotes) | — |

### 1.5 `[links]`

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `links.first` | **REQ** | (empty) | First link (most prominent on resume) | At minimum your LinkedIn. Wolf infers link type from URL. |
| `links.second` | OPT | (empty) | Second link (also on resume if there's room) | — |
| `links.others` | OPT | (empty) | Other links | Additional URLs, one per line. |
| `links.note` | OPT | (empty) | (skip — collectNotes) | — |

### 1.6 `[job_preferences]`

| Path | Req | Default | In search ctx | Heading | Help |
|---|---|---|---|---|---|
| `job_preferences.target_roles` | **REQ** | (empty) | ✓ | Target roles | One role per line (markdown bullets). |
| `job_preferences.target_locations` | **REQ** | (empty) | ✓ | Target locations | One location per line. |
| `job_preferences.remote_preference` | OPT | `no preference` | ✓ | Remote preference | "remote only" / "hybrid only" / "onsite only" / "no preference". |
| `job_preferences.relocation_preferences` | OPT | (empty) | ✓ | Relocation preferences | **Freeform** — collapsed from 5 fields in β.10f. Cover scope (metro / state / cross-country / international) + caveats. |
| `job_preferences.sponsorship_preferences` | OPT | (empty) | ✓ | Sponsorship preferences | **Freeform** — collapsed from 6 fields in β.10f. Mention H-1B / GC / CPT / OPT / no-sponsorship-only + conditions. |
| `job_preferences.hard_reject_companies` | OPT | (empty) | ✓ | Hard-reject companies (NEVER recommend) | One per line, markdown bullets. |
| `job_preferences.precision_apply_companies` | OPT | (empty) | ✓ | Precision-apply companies (recommend, but flag manual-apply) | One per line, markdown bullets. Wolf tailors but does not auto-fill. |
| `job_preferences.min_hourly_rate_usd` | OPT | (empty) | ✓ | Minimum hourly rate (intern, USD) | Intern role floor. Blank = no floor. |
| `job_preferences.min_annual_salary_usd` | OPT | (empty) | ✓ | Minimum annual salary (new grad, USD) | NG role floor. Blank = no floor. |
| `job_preferences.scoring_notes` | OPT | (empty) | ✓ | Scoring notes | Free-form preferences for the AI scorer. |
| `job_preferences.note` | OPT | (empty) | — | User notes | Job-search "small thoughts". Renders inside Job Preferences H1. |

### 1.7 `[demographics]` — all OPT by US EEO law

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `demographics.race` | OPT | (empty) | Race | OPTIONAL EEO. |
| `demographics.gender` | OPT | (empty) | Gender | OPTIONAL EEO. |
| `demographics.ethnicity` | OPT | (empty) | Ethnicity | OPTIONAL EEO. "Hispanic or Latino" / "Not Hispanic or Latino" / "Decline to answer". |
| `demographics.veteran_status` | OPT | `I am not a protected veteran` | Veteran status | OPTIONAL EEO. |
| `demographics.disability_status` | OPT | (empty) | Disability status | OPTIONAL EEO. |
| `demographics.lgbtq` | OPT | (empty) | LGBTQ+ | OPTIONAL. |
| `demographics.transgender` | OPT | (empty) | Transgender | OPTIONAL. |
| `demographics.first_gen_college` | OPT | `No` | First-generation college student | "Yes" / "No" / "Decline to answer". |
| `demographics.note` | OPT | (empty) | (skip — collectNotes) | — |

### 1.8 `[clearance]`

| Path | Req | Default | In search ctx | Heading | Help |
|---|---|---|---|---|---|
| `clearance.preferences` | OPT | (empty) | ✓ | Clearance preferences | **Freeform** — collapsed from 4 fields in β.10f. Whether you hold an active clearance (Secret / TS / TS-SCI), its status (Active / Inactive / Eligible), and willingness to obtain. |
| `clearance.note` | OPT | (empty) | (skip — collectNotes) | — |

### 1.9 `[form_answers]` — verbatim ATS form answers

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `form_answers.authorized_to_work` | **REQ** | (empty) | Form answer — Are you authorized to work? | Verbatim form answer (e.g. "Yes, I am authorized to work in the United States."). |
| `form_answers.require_sponsorship` | **REQ** | (empty) | Form answer — Do you require sponsorship? | Verbatim form answer. |
| `form_answers.willing_to_relocate` | **REQ** | (empty) | Form answer — Are you willing to relocate? | Verbatim form answer. |
| `form_answers.salary_expectation` | OPT | `Open to discuss based on the full compensation package and role scope.` | What's your salary expectation? | Default in template; edit if you want a different stance. |
| `form_answers.how_did_you_hear` | OPT | `LinkedIn` | How did you hear about us? | Default "LinkedIn". |
| `form_answers.when_can_you_start` | OPT | `Available immediately` | When can you start? | — |
| `form_answers.note` | OPT | (empty) | (skip — collectNotes) | — |

### 1.10 `[documents]` — files inside `attachments/`

Filenames must include extension — wolf does NOT auto-append `.pdf`.

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `documents.transcript` | OPT | (empty) | Transcript | Bare filename incl. extension (e.g. `transcript.pdf`). |
| `documents.unofficial_transcript` | OPT | (empty) | Unofficial transcript | Bare filename incl. extension. |
| `documents.reference_letter` | OPT | (empty) | Reference letter | Bare filename incl. extension. |
| `documents.portfolio_sample` | OPT | (empty) | Portfolio sample | Bare filename incl. extension (e.g. `portfolio.pdf` or `portfolio.zip`). |
| `documents.note` | OPT | (empty) | (skip — collectNotes) | — |

### 1.11 `[skills]` — combined into one resume body block (no per-field heading)

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `skills.languages` | OPT | (empty) | (skip — combined) | Programming languages. Comma- or newline-separated. |
| `skills.frameworks` | OPT | (empty) | (skip — combined) | — |
| `skills.tools` | OPT | (empty) | (skip — combined) | — |
| `skills.domains` | OPT | (empty) | (skip — combined) | — |
| `skills.free_text` | OPT | (empty) | (skip — combined) | Skills not fitting the buckets above. |

### 1.12 Optional resume sections — each is `<table>.items` + `<table>.note`

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `awards.items` | OPT | (empty) | Awards & Honors | One per line. |
| `awards.note` | OPT | (empty) | (skip — collectNotes) | — |
| `publications.items` | OPT | (empty) | Publications | — |
| `publications.note` | OPT | (empty) | (skip — collectNotes) | — |
| `patents.items` | OPT | (empty) | Patents | — |
| `patents.note` | OPT | (empty) | (skip — collectNotes) | — |
| `hackathons.items` | OPT | (empty) | Hackathons | — |
| `hackathons.note` | OPT | (empty) | (skip — collectNotes) | — |
| `open_source.items` | OPT | (empty) | Open Source | — |
| `open_source.note` | OPT | (empty) | (skip — collectNotes) | — |
| `certifications.items` | OPT | (empty) | Certifications | — |
| `certifications.note` | OPT | (empty) | (skip — collectNotes) | — |
| `languages_spoken.items` | OPT | (empty) | Languages | Spoken languages with proficiency. |
| `languages_spoken.note` | OPT | (empty) | (skip — collectNotes) | — |
| `volunteer.items` | OPT | (empty) | Volunteer | — |
| `volunteer.note` | OPT | (empty) | (skip — collectNotes) | — |
| `interests.free_text` | OPT | (empty) | Interests | Brief and genuine. |
| `interests.note` | OPT | (empty) | (skip — collectNotes) | — |
| `speaking.items` | OPT | (empty) | Speaking | Conference talks, panels, podcasts. |
| `speaking.note` | OPT | (empty) | (skip — collectNotes) | — |

---

## 2. Profile — array-of-tables (resume pool + stories)

Per-entry fields are NOT in PROFILE_FIELDS — there's no static path
because the user picks the `<id>`. Schema lives in
`src/utils/profileToml.ts` zod definitions. All fields are
`multilineString` except `id` (string, required) and `story.required`
(boolean).

### 2.1 `[[experience]]` — `wolf profile add experience`

Path shape: `experience.<id>.<field>`.

| Field | Req | Default | Help |
|---|---|---|---|
| `id` | **REQ** | — | snake/dash-case slug (e.g. `amazon-internship-2024`). Auto-generated from `--slug-from`. |
| `job_title` | OPT | (empty) | e.g. "Software Engineer Intern". |
| `company` | OPT | (empty) | e.g. "Amazon". |
| `start` | OPT | (empty) | YYYY-MM. |
| `end` | OPT | (empty) | YYYY-MM or "Present". |
| `location` | OPT | (empty) | e.g. "Seattle, WA". |
| `bullets` | OPT | (empty) | Resume bullets, one per line, markdown style. |
| `subnote` | OPT | (empty) | Free-form notes for AI / future self. Picked up by `collectNotes`. |

### 2.2 `[[project]]` — `wolf profile add project`

| Field | Req | Default | Help |
|---|---|---|---|
| `id` | **REQ** | — | snake/dash-case slug. |
| `name` | OPT | (empty) | Project name. |
| `year` | OPT | (empty) | e.g. "2023". |
| `tech_stack` | OPT | (empty) | One per line, markdown bullets. |
| `bullets` | OPT | (empty) | Resume bullets. |
| `subnote` | OPT | (empty) | Free-form notes; collectNotes. |

### 2.3 `[[education]]` — `wolf profile add education`

| Field | Req | Default | Help |
|---|---|---|---|
| `id` | **REQ** | — | snake/dash-case slug. |
| `degree` | OPT | (empty) | e.g. "B.S. in Computer Science". |
| `school` | OPT | (empty) | e.g. "University of X". |
| `start` | OPT | (empty) | YYYY-MM. |
| `end` | OPT | (empty) | YYYY-MM or "Present". |
| `gpa` | OPT | (empty) | e.g. "3.8/4.0". |
| `relevant_coursework` | OPT | (empty) | One per line, markdown bullets. |
| `subnote` | OPT | (empty) | Free-form notes; collectNotes. |

### 2.4 `[[story]]` — behavioral interview answers

`story.required` is the only **boolean** field anywhere in the profile
schema. Wolf-builtin story ids are protected: `wolf profile remove
story <id>` and `set story.<id>.prompt` / `.required` refuse builtins.

| Field | Type | Req | Default | Help |
|---|---|---|---|---|
| `id` | string | **REQ** | — | snake_case slug; for builtins, see registry below. |
| `prompt` | multilineString | OPT | (builtin: prompt text from registry) | The interview question. Read-only on builtins. |
| `required` | **boolean** | OPT | false | Whether `wolf doctor` flags an empty `star_story`. Read-only on builtins. |
| `star_story` | multilineString | OPT | (empty) | Your STAR-format answer. |
| `subnote` | multilineString | OPT | (empty) | Free-form notes; collectNotes. |

#### 2.4.1 Wolf-builtin stories (WOLF_BUILTIN_STORIES, 17 entries)

These get pre-seeded in every fresh profile.toml. Lazy-injected on read
if missing (no schemaVersion bump for new builtins).

| id | prompt | required |
|---|---|---|
| `tell_me_about_yourself` | Tell me about yourself | ✓ |
| `tell_me_about_failure` | Tell me about a time you failed | ✓ |
| `tell_me_about_conflict` | Tell me about a time you faced conflict | ✓ |
| `biggest_strength` | Biggest strength | ✓ |
| `biggest_weakness` | Biggest weakness (with what you're doing about it) | ✓ |
| `five_year_goal` | Where do you see yourself in 5 years? | ✓ |
| `why_leaving_current_role` | Why are you leaving your current role? | ✗ |
| `handle_stress_failure` | How do you handle stress / failure? | ✓ |
| `what_motivates` | What motivates you? | ✓ |
| `led_team_or_project` | Describe a time you led a team or project | ✓ |
| `handled_disagreed_feedback` | Describe a time you handled feedback you disagreed with | ✓ |
| `management_style` | What is your management style? | ✗ |
| `proudest_project` | Tell me about a project you're proud of | ✓ |
| `view_company_framework` | How do you view our company? — your framework | ✓ |
| `view_product_framework` | How do you view our product? — your framework | ✓ |
| `suggestions_company_framework` | What suggestions do you have for our company? — your framework | ✓ |
| `suggestions_product_framework` | What suggestions do you have for our product? — your framework | ✓ |

---

## 3. Jobs — SQLite columns (JOB_FIELDS + system fields)

Jobs are flat (no nested paths). 19 editable fields + 4 system-managed
fields (refused by `wolf job set`).

### 3.1 Editable fields (JOB_FIELDS)

| Name | Type | Req | Default | Help / enum values |
|---|---|---|---|---|
| `title` | string | **REQ** | — | Role title (e.g. "Software Engineer Intern"). |
| `url` | string | **REQ** | — | Application or listing URL. |
| `source` | **enum** | **REQ** | — | `LinkedIn` / `Indeed` / `handshake` / `Company website` / `Other`. |
| `location` | string | **REQ** | — | Office location for the role. |
| `remote` | **boolean** | **REQ** | — | Accepts `true`/`false`/`yes`/`no`/`1`/`0`. |
| `salary` | **salary** | OPT | null | `number` (annual USD), `unpaid`, or blank for null. |
| `workAuthorizationRequired` | **enum** | **REQ** | — | `no sponsorship` / `Green card` / `Work visa` / `OPT` / `CPT`. |
| `clearanceRequired` | **boolean** | **REQ** | — | true/false. |
| `score` | **number** | OPT | null | AI relevance score 0.0..1.0. Blank to clear. |
| `scoreJustification` | multilineString | OPT | null | AI-generated explanation. |
| `status` | **enum** | **REQ** | — | `new` / `reviewed` / `ignored` / `filtered` / `applied` / `applied_previously` / `interview` / `offer` / `rejected` / `closed` / `error`. |
| `error` | **nullableEnum** | OPT | null | `score_extraction_error` / `score_error` / `tailor_resume_error` / `tailor_cover_letter_error` / `tailor_compile_error` / `fill_detection_error` / `fill_submit_error` / `reach_contact_error` / `reach_draft_error` / `reach_send_error` / blank. |
| `appliedProfileId` | nullableString | OPT | null | Profile dirname used to apply. Blank = not yet applied. |
| `tailoredResumePdfPath` | nullableString | OPT | null | Path to the tailored resume PDF. |
| `coverLetterHtmlPath` | nullableString | OPT | null | Path to the generated cover letter HTML. |
| `coverLetterPdfPath` | nullableString | OPT | null | Path to the cover letter PDF. |
| `screenshotPath` | nullableString | OPT | null | Path to the per-application screenshot folder. |
| `outreachDraftPath` | nullableString | OPT | null | Path to the outreach email draft (.eml). |
| `description_md` | multilineString | OPT | (empty) | Full JD prose. Use `--from-file` for long content. Stored in the `description_md` SQLite column, accessed via `JobRepository.readJdText` / `writeJdText`. |

### 3.2 System-managed fields (refused by `wolf job set`)

| Name | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. Set by `wolf add` / `wolf hunt`. |
| `companyId` | string (foreign key) | → `companies.id`. Not user-editable; companies have their own management surface. |
| `createdAt` | string (ISO 8601) | Set on insert. |
| `updatedAt` | string (ISO 8601) | Touched by every `JobRepository.update` / `save`. |

---

## 4. Type-distribution summary

| Layer | Total fields | string-typed | Real types (enum/boolean/number/etc.) |
|---|---|---|---|
| Profile flat (PROFILE_FIELDS) | 56 | 56 | 0 |
| Profile arrays (experience / project / education / story) | 31 fields × N entries | 30 | 1 (`story.required` = boolean) |
| Jobs (JOB_FIELDS + system) | 23 | 9 | 14 (5 enum + 2 boolean + 2 number/salary + 5 nullable variants) |

**Profile is freeform user prose.** Jobs are structured pipeline state.
That's the intentional split: profile = "what the user wants to say
about themselves", jobs = "what wolf needs to track to drive the
pipeline".

---

## 5. Review prompts

Things worth deciding when reviewing this snapshot:

1. **Required-set on profile.** Are 8 REQUIRED fields (`identity.legal_first_name` / `legal_last_name` / `country_of_citizenship` / `contact.email` / `contact.phone` / `address.full` / `links.first` / `job_preferences.target_roles` / `target_locations` / `form_answers.authorized_to_work` / `require_sponsorship` / `willing_to_relocate`) the right floor for tailor to run? Doctor blocks tailor until all are filled.

2. **Demographics defaults.** `veteran_status = "I am not a protected veteran"` and `first_gen_college = "No"` are seeded — fine for most users but presumptuous. Worth blanking?

3. **`form_answers.salary_expectation` default text.** "Open to discuss based on the full compensation package and role scope." — generic but maybe weak. Better default phrasing?

4. **Skills sub-fields.** Currently 5 sub-fields (Languages / Frameworks / Tools / Domains / free_text) combined into one resume body block. Split feels right for resume rendering, but could collapse to a single freeform prose block too — same argument as relocation/sponsorship. Decide.

5. **Optional resume sections.** 10 sections (awards / publications / patents / hackathons / open_source / certifications / languages_spoken / volunteer / interests / speaking) each with `items` + `note`. Are all 10 worth keeping? Hackathons + volunteer + speaking might be combinable into one "extras" pool.

6. **`*.note` paths.** 12 of them across profile (one per top-level table + per-entry subnotes). They feed `collectNotes()` for the search context "small thoughts". Worth it, or noise?

7. **Job `description_md` location.** Currently a SQLite column accessed via repo's `readJdText` / `writeJdText`. `wolf job get description_md` works but feels asymmetric — it's not on the `Job` interface. Lift to the interface?

8. **Job `companyId` editability.** Currently system-managed (refused by `set`). If a user wants to re-attribute a job to a different company, they'd need a separate flow. Worth exposing?

9. **Job artifact paths.** 5 nullableString paths (`tailoredResumePdfPath` etc.) — system-set by tailor / fill / reach. Probably should be system-managed (refused by `set`), not user-editable. Currently they ARE editable through `wolf job set`.

10. **Wolf-builtin stories.** 17 prompts. Cull / add some? Notably "How do you view our company? — your framework" and "What suggestions do you have for our company? — your framework" are wolf-specific (frameworks on top of the canonical interview prompts). Worth keeping the framework-style ones?
