# Fields audit

Snapshot of every wolf-defined field for review. Generated from
`src/utils/profileFields.ts`, `src/utils/profileToml.ts`, and
`src/utils/jobFields.ts` as of commit `1fed94d` (β.10g/h/i/j) + the
β.10k unpaid-sentinel cleanup.

Use this to decide which fields to keep / collapse / split / rename.
After review, edits land on the source files (this doc is review-only,
not a code source-of-truth).

## Recent rounds (audit-driven refactors)

| Round | Commit | What changed |
|---|---|---|
| β.10f | (in feat/migration-runner-framework) | relocation_* (5) + sponsorship_* (6) + clearance.* (4) → 3 freeform fields |
| β.10g | `0a20dfa` | form_answers (6) + WOLF_BUILTIN_STORIES (17) merged into [[question]] (23 builtin) |
| β.10h | `0a20dfa` | Job artifact paths (5 nullable strings) → 4 booleans + JobRepository.getArtifactPath() |
| β.10i | `1fed94d` | skills.* (5) → skills.text (1); *.note rendered inline at end of H1 block, not extracted |
| β.10j | `1fed94d` | Job.salary → salaryLow + salaryHigh; salary_expectation static default removed (AI-derived) |
| β.10k | (in this branch) | Removed `"unpaid"` sentinel from Salary type. salaryLow / salaryHigh = `number \| null`; 0 = explicit unpaid, null = unknown |

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
| `resume.note` | OPT | (empty) | (skip — no inline render today) | Free-form notes about resume preferences. |

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
| `identity.note` | OPT | (empty) | Notes | Renders inline at end of Identity H1 block (β.10i). |

### 1.3 `[contact]`

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `contact.email` | **REQ** | (empty) | Email | Resume header & outreach From: address. |
| `contact.phone` | **REQ** | (empty) | Phone | Resume header. |
| `contact.note` | OPT | (empty) | Notes | Renders inline at end of Contact H1 block. |

### 1.4 `[address]`

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `address.full` | **REQ** | (empty) | Full address | Complete address including country. |
| `address.note` | OPT | (empty) | Notes | Renders inline at end of Address H1 block. |

### 1.5 `[links]`

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `links.first` | **REQ** | (empty) | First link (most prominent on resume) | At minimum your LinkedIn. Wolf infers link type from URL. |
| `links.second` | OPT | (empty) | Second link (also on resume if there's room) | — |
| `links.others` | OPT | (empty) | Other links | Additional URLs, one per line. |
| `links.note` | OPT | (empty) | Notes | Renders inline at end of Links H1 block. |

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
| `job_preferences.note` | OPT | (empty) | ✓ | Notes | Renders inline at end of Job Preferences H1 block. β.10i: also surfaces in search context. |

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
| `demographics.note` | OPT | (empty) | Notes | Renders inline at end of Demographics H1 block. |

### 1.8 `[clearance]`

| Path | Req | Default | In search ctx | Heading | Help |
|---|---|---|---|---|---|
| `clearance.preferences` | OPT | (empty) | ✓ | Clearance preferences | **Freeform** — collapsed from 4 fields in β.10f. Whether you hold an active clearance (Secret / TS / TS-SCI), its status (Active / Inactive / Eligible), and willingness to obtain. |
| `clearance.note` | OPT | (empty) | ✓ | Notes | β.10i: renders inline at end of Clearance H1 block. |

### 1.9 ~~`[form_answers]`~~ — REMOVED (β.10g)

The 6 verbatim ATS answers (work auth / sponsorship / willingness to
relocate / salary expectation / how did you hear / when can you start)
moved into `[[question]]` as builtin entries. See §2.4.1.

### 1.10 `[documents]` — files inside `attachments/`

Filenames must include extension — wolf does NOT auto-append `.pdf`.

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `documents.transcript` | OPT | (empty) | Transcript | Bare filename incl. extension (e.g. `transcript.pdf`). |
| `documents.unofficial_transcript` | OPT | (empty) | Unofficial transcript | Bare filename incl. extension. |
| `documents.reference_letter` | OPT | (empty) | Reference letter | Bare filename incl. extension. |
| `documents.portfolio_sample` | OPT | (empty) | Portfolio sample | Bare filename incl. extension (e.g. `portfolio.pdf` or `portfolio.zip`). |
| `documents.note` | OPT | (empty) | (skip — no inline render today) | — |

### 1.11 `[skills]` — one freeform field (β.10i)

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `skills.text` | OPT | (empty) | Skills (resume_pool only) | Free-form skills summary. Languages / frameworks / tools / domains in any layout — tailor reformats per JD. |

### 1.12 Optional resume sections — each is `<table>.items` + `<table>.note`

| Path | Req | Default | Heading | Help |
|---|---|---|---|---|
| `awards.items` | OPT | (empty) | Awards & Honors | One per line. |
| `awards.note` | OPT | (empty) | (skip — no inline render today) | — |
| `publications.items` | OPT | (empty) | Publications | — |
| `publications.note` | OPT | (empty) | (skip — no inline render today) | — |
| `patents.items` | OPT | (empty) | Patents | — |
| `patents.note` | OPT | (empty) | (skip — no inline render today) | — |
| `hackathons.items` | OPT | (empty) | Hackathons | — |
| `hackathons.note` | OPT | (empty) | (skip — no inline render today) | — |
| `open_source.items` | OPT | (empty) | Open Source | — |
| `open_source.note` | OPT | (empty) | (skip — no inline render today) | — |
| `certifications.items` | OPT | (empty) | Certifications | — |
| `certifications.note` | OPT | (empty) | (skip — no inline render today) | — |
| `languages_spoken.items` | OPT | (empty) | Languages | Spoken languages with proficiency. |
| `languages_spoken.note` | OPT | (empty) | (skip — no inline render today) | — |
| `volunteer.items` | OPT | (empty) | Volunteer | — |
| `volunteer.note` | OPT | (empty) | (skip — no inline render today) | — |
| `interests.free_text` | OPT | (empty) | Interests | Brief and genuine. |
| `interests.note` | OPT | (empty) | (skip — no inline render today) | — |
| `speaking.items` | OPT | (empty) | Speaking | Conference talks, panels, podcasts. |
| `speaking.note` | OPT | (empty) | (skip — no inline render today) | — |

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

### 2.4 `[[question]]` — Q&A pool consumed by fill / tailor / reach (β.10g)

Renamed from `[[story]]` in β.10g. Holds **both** short verbatim ATS
answers (former `[form_answers]`) and long-form behavioral STAR stories
in one array. `question.required` is the only **boolean** field
anywhere in the profile schema. Wolf-builtin question ids are protected:
`wolf profile remove question <id>` and `set question.<id>.prompt` /
`.required` refuse builtins.

| Field | Type | Req | Default | Help |
|---|---|---|---|---|
| `id` | string | **REQ** | — | snake_case slug; for builtins, see registry below. |
| `prompt` | multilineString | OPT | (builtin: prompt text from registry) | The question. Read-only on builtins. |
| `required` | **boolean** | OPT | false | Whether `wolf doctor` flags an empty `answer`. Read-only on builtins. |
| `answer` | multilineString | OPT | (builtin: defaultAnswer if any, else empty) | The verbatim text wolf fill / tailor / reach pulls. |
| `subnote` | multilineString | OPT | (empty) | Free-form notes attached to this Q&A. Renders inline with the entry, not extracted. |

#### 2.4.1 Wolf-builtin questions (WOLF_BUILTIN_QUESTIONS, 23 entries)

Pre-seeded in every fresh profile.toml. Lazy-injected on read if missing
(no schemaVersion bump for new builtins).

| id | prompt | required | defaultAnswer |
|---|---|---|---|
| **Short ATS Q&A (former `[form_answers]`)** | | | |
| `authorized_to_work` | Are you legally authorized to work in the country of this job? | ✓ | — |
| `require_sponsorship` | Will you now or in the future require sponsorship for employment? | ✓ | — |
| `willing_to_relocate` | Are you willing to relocate for this role? | ✓ | — |
| `salary_expectation` | What's your salary expectation? | ✗ | — *(β.10j: AI-derived from JD range at fill time)* |
| `how_did_you_hear` | How did you hear about us? | ✗ | `LinkedIn` |
| `when_can_you_start` | When can you start? | ✗ | `Available immediately` |
| **Behavioral / opinion long answers** | | | |
| `tell_me_about_yourself` | Tell me about yourself | ✓ | — |
| `tell_me_about_failure` | Tell me about a time you failed | ✓ | — |
| `tell_me_about_conflict` | Tell me about a time you faced conflict | ✓ | — |
| `biggest_strength` | Biggest strength | ✓ | — |
| `biggest_weakness` | Biggest weakness (with what you're doing about it) | ✓ | — |
| `five_year_goal` | Where do you see yourself in 5 years? | ✓ | — |
| `why_leaving_current_role` | Why are you leaving your current role? | ✗ | — |
| `handle_stress_failure` | How do you handle stress / failure? | ✓ | — |
| `what_motivates` | What motivates you? | ✓ | — |
| `led_team_or_project` | Describe a time you led a team or project | ✓ | — |
| `handled_disagreed_feedback` | Describe a time you handled feedback you disagreed with | ✓ | — |
| `management_style` | What is your management style? | ✗ | — |
| `proudest_project` | Tell me about a project you're proud of | ✓ | — |
| `view_company_framework` | How do you view our company? — your framework | ✓ | — |
| `view_product_framework` | How do you view our product? — your framework | ✓ | — |
| `suggestions_company_framework` | What suggestions do you have for our company? — your framework | ✓ | — |
| `suggestions_product_framework` | What suggestions do you have for our product? — your framework | ✓ | — |

---

## 3. Jobs — SQLite columns (JOB_FIELDS + system fields)

Jobs are flat (no nested paths). 18 editable fields + 4 system-managed
fields (refused by `wolf job set`).

### 3.1 Editable fields (JOB_FIELDS)

| Name | Type | Req | Default | Help / enum values |
|---|---|---|---|---|
| `title` | string | **REQ** | — | Role title (e.g. "Software Engineer Intern"). |
| `url` | string | **REQ** | — | Application or listing URL. |
| `source` | **enum** | **REQ** | — | `LinkedIn` / `Indeed` / `handshake` / `Company website` / `Other`. |
| `location` | string | **REQ** | — | Office location for the role. |
| `remote` | **boolean** | **REQ** | — | Accepts `true`/`false`/`yes`/`no`/`1`/`0`. |
| `salaryLow` | **number** | OPT | null | Lower bound of annual USD. **0 = explicitly unpaid; null = unknown.** β.10j+k. |
| `salaryHigh` | **number** | OPT | null | Upper bound of annual USD. Blank if single-point or unknown. Allowed even when `salaryLow=0` (e.g. unpaid base + bonus). |
| `workAuthorizationRequired` | **enum** | **REQ** | `unknown` | `unknown` / `no sponsorship` / `Green card` / `Work visa` / `OPT` / `CPT`. `unknown` means the JD did not state sponsorship. |
| `clearanceRequired` | **boolean** | **REQ** | — | true/false. |
| `score` | **number** | OPT | null | AI relevance score 0.0..1.0. Blank to clear. |
| `scoreJustification` | multilineString | OPT | null | AI-generated explanation. |
| `status` | **enum** | **REQ** | — | `new` / `reviewed` / `ignored` / `filtered` / `applied` / `applied_previously` / `interview` / `offer` / `rejected` / `closed` / `error`. |
| `error` | **nullableEnum** | OPT | null | `score_extraction_error` / `score_error` / `tailor_resume_error` / `tailor_cover_letter_error` / `tailor_compile_error` / `fill_detection_error` / `fill_submit_error` / `reach_contact_error` / `reach_draft_error` / `reach_send_error` / blank. |
| `appliedProfileId` | nullableString | OPT | null | Profile dirname used to apply. Blank = not yet applied. |
| `hasTailoredResume` | **boolean** | OPT | false | β.10h: whether tailor produced `resume.pdf` (path = convention via `JobRepository.getArtifactPath`). |
| `hasTailoredCoverLetter` | **boolean** | OPT | false | β.10h: whether tailor produced `cover_letter.html` + `cover_letter.pdf`. |
| `hasScreenshots` | **boolean** | OPT | false | β.10h: whether fill recorded the `screenshots/` directory. |
| `hasOutreachDraft` | **boolean** | OPT | false | β.10h: whether reach drafted `outreach.eml`. |
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

| Layer | Total fields | string-typed | Real types (enum/boolean/number) |
|---|---|---|---|
| Profile flat (PROFILE_FIELDS) | ~50 | all | 0 |
| Profile arrays (experience / project / education / question) | 27 fields × N entries | 26 | 1 (`question.required` = boolean) |
| Jobs (JOB_FIELDS + system) | 22 | 8 | 14 (5 enum + 6 boolean + 2 number + 3 nullable variants) |

**Profile is freeform user prose.** Jobs are structured pipeline state.
That's the intentional split: profile = "what the user wants to say
about themselves", jobs = "what wolf needs to track to drive the
pipeline".

---

## 5. Review status (latest answers)

| # | Topic | Decision |
|---|---|---|
| 1 | Required-set on profile (8 REQ fields) | Pending — not yet reviewed |
| 2 | Demographics defaults (`veteran_status` / `first_gen_college`) | **Keep as-is** ("用默认就好") |
| 3 | `salary_expectation` default | **Removed** — AI computes from JD range at fill time (β.10j) |
| 3' | `Job.salary` shape | **Split low/high** (β.10j); `0 = unpaid, null = unknown` (β.10k) |
| 4 | `[skills]` 5 sub-fields | **Collapsed to one `skills.text`** (β.10i) |
| 4' | `form_answers` + `[[story]]` | **Merged into `[[question]]`** (β.10g) |
| 5 | 10 optional resume sections | **Keep all** ("都留着") |
| 6 | `*.note` paths | **Render inline** with parent table H1 block (β.10i) — separate `## User notes` extract removed |
| 7 | `description_md` SQLite location | **Keep on SQLite column** ("有时候需要 fallback to md，尤其是 migrant") |
| 8 | `Job.companyId` editability | **Refused** — re-create job to change company |
| 9 | Job artifact paths | **Replaced with 4 booleans** + convention path helper (β.10h) |
| 10 | Wolf-builtin questions cull | **Keep all 23** ("不用，就这样了") |

### Open items

- **#1 — Required-set audit.** `wolf doctor` currently flags REQ on:
  identity (legal_first_name, legal_last_name, country_of_citizenship),
  contact (email, phone), address (full), links (first), job_preferences
  (target_roles, target_locations), and the 3 builtin questions
  (`authorized_to_work`, `require_sponsorship`, `willing_to_relocate`).
  Are these the right floor for `wolf tailor` to run?

### β.10k clarifications (this branch, not yet committed)

- `Salary` type stripped to `number`. The `"unpaid"` string sentinel is
  gone; `0` carries that meaning explicitly.
- `salaryLow=0` + `salaryHigh=any number` is **valid** — e.g. unpaid
  base with bonus ceiling. Coercion does not validate the (low, high)
  pair.
- JOB_FIELDS' `salary` JobFieldType removed; both salary fields use the
  generic `'number'` coercer. Help text spells out 0-vs-null convention.
