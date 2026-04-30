# v2 Profile Redesign — BFS overview

> v2 = the commit chain α + β.1 → β.9 (branch `feat/migration-runner-framework`).
>
> This doc walks the redesign breadth-first: big picture → per-commit
> summary → drill into β.1 (the keystone) → quick notes on the others.

## Big picture (layer 1)

v2 does one thing: **replace v1's "three markdown files + jd.md"
with v2's "single profile.toml + jobs SQLite column"**.

```
v1 workspace                          v2 workspace
─────────────                          ─────────────
profiles/default/                      profiles/default/
├── profile.md            ─┐           └── profile.toml      ← one file
├── resume_pool.md         │ ─merge→
└── standard_questions.md ─┘

data/jobs/<dir>/                       data/wolf.sqlite
└── jd.md                 ─migrate→    jobs.description_md   ← SQLite column
```

That swap, done smoothly + leaving an editable / readable artifact, takes nine commits.

## Per-commit summary (layer 2)

| commit | one line |
|---|---|
| **α** | Workspace upgrade framework (schemaVersion + migration runner). Every breaking change uses it from now on. |
| **β.1** | **Defines the v2 data shape** — TOML schema, template, field metadata, parser. |
| **β.2** | "Edit one TOML field in place without nuking the comments" helpers (surgical edit). |
| **β.3** | Real v1→v2 migration (old md trio → profile.toml) using α + β.2. |
| **β.4** | Make wolf actually read profile.toml and render markdown for tailor / fill / reach (which still want markdown input). |
| **β.5** | Expose `wolf profile show / get / set / add / remove / fields`. |
| **β.6** | doctor and assertReadyForTailor stop grep'ing markdown and consume the structured ProfileToml. |
| **β.7** | jd.md disk file → `jobs.description_md` SQLite column; migration vacuums old jd.md into the column. |
| **β.8** | New command `wolf context --for=search/tailor` — task-scoped markdown bundle for AI agents. |
| **β.9** | Rewrite workspace-claude.md so AI agents in a wolf workspace know the new v2 workflow. |

## β.1 deep dive (layer 3)

β.1 ships **four files** that together define "what profile data looks
like in v2, how to parse it, and how to validate it".

### File relationships

```
profile.toml (template)        ← data: what user files look like
   │
   ├──"what fields exist?" ─→  profileFields.ts (PROFILE_FIELDS)
   │                              answers "where is contact.email?
   │                              required? what does it mean?"
   │
   ├──"read it as code" ────→  profileToml.ts (parseProfileToml + zod)
   │                              answers "what TS object does it parse to?
   │                              is it valid?"
   │
   └──"what built-in stories?"→ storyFields.ts (WOLF_BUILTIN_STORIES)
                                   answers "what are the 17 builtin
                                   behavioral prompts and their ids?"
```

### 1. `profile.toml` template — disk shape

```toml
schemaVersion = 2

# REQUIRED — Wolf cannot guess this. Used as the resume header.
[identity]
legal_first_name = """

"""

# REQUIRED — Resume header & outreach From: address.
[contact]
email = """

"""

# 17 builtin behavioral stories, one block each
[[story]]
id = "tell_me_about_failure"
prompt = """
Tell me about a time you failed
"""
required = true
star_story = """

"""
```

This is what `wolf init` writes to disk. Empty values, full structure,
inline comments that act as REQUIRED / OPTIONAL hints to the user.

### 2. `profileFields.ts` — the field reference book

```ts
export const PROFILE_FIELDS = [
  { path: 'identity.legal_first_name', required: true,  type: 'multilineString',
    help: 'Used as the resume header.' },
  { path: 'contact.email',             required: true,  type: 'multilineString',
    help: 'Resume header & outreach From: address.' },
  // ~70 entries
];
```

Drives:
- `wolf profile fields` (humans / AI read the reference)
- `wolf profile fields --required` (filter to required)
- `wolf doctor` (which fields must be filled)

Why hardcoded TS instead of parsing template comments? The TS table is
the source of truth — grep-able, type-checked, IDE-jumpable. Parsing
comments is fragile to wording drift. A unit test pins both directions
of alignment with the template.

### 3. `storyFields.ts` — the 17 builtin prompts

```ts
export const WOLF_BUILTIN_STORIES = [
  { id: 'tell_me_about_yourself',  prompt: 'Tell me about yourself',           required: true },
  { id: 'tell_me_about_failure',   prompt: 'Tell me about a time you failed',  required: true },
  // ... 17 total
];
```

Stories live in their own file because the shape differs from
PROFILE_FIELDS (an array with prompt text + required flag, vs flat
dot-path metadata). Forcing them together would be ugly.

Drives:
- `wolf init` seeds all 17 into profile.toml
- `injectMissingBuiltinStories` (lazy inject): when wolf later adds an
  18th, older profile.toml files automatically gain it on next read
- `wolf doctor` checks all `required: true` builtins have a star_story
- v1→v2 migration looks up builtin id by old prompt text (the old
  `## Tell me about a time you failed` H2 → `story.tell_me_about_failure.star_story`)

### 4. `profileToml.ts` — parser + helpers

The bridge from "TOML on disk" to "TypeScript object".

```ts
// zod schema defines the shape
export const ProfileTomlSchema = z.object({
  schemaVersion: z.number().int().positive(),
  identity: IdentitySchema,
  contact: ContactSchema,
  // ... 21 tables
  experience: z.array(ExperienceEntrySchema).default([]),
  story: z.array(StoryEntrySchema).default([]),
});

export type ProfileToml = z.infer<typeof ProfileTomlSchema>;

// main API
export function parseProfileToml(text: string): ProfileToml {
  const obj = parseTomlText(text);            // smol-toml
  const parsed = ProfileTomlSchema.parse(obj);  // zod validation
  return injectMissingBuiltinStories(parsed);   // lazy inject
}

// helpers
export function isFilled(value: string): boolean {
  return value.trim().length > 0;
}

export function getByPath(profile: ProfileToml, dotPath: string) { /* ... */ }
```

**Key convention**: every text field is `z.string().default('')`:
- Disk has `email = """gerry@x.com"""` → parsed as `'gerry@x.com'`
- Disk has `email = """\n\n"""` (whitespace) → parsed as `'\n'`,
  `isFilled` returns false
- Disk omits the field entirely → zod default `''`, still valid

This lets wolf code uniformly use `isFilled(profile.contact.email)`
without caring whether the on-disk value was empty string, blank, or
missing.

### Tests pinned (20 cases)

1. The bundled template parses cleanly — every template field path
   exists in the schema
2. All 17 builtin stories are seeded, with required flags matching
   `storyFields.ts`
3. Lazy inject behavior — empty story array gets filled; existing
   builtin star_story is preserved; user-custom stories pass through
4. isFilled boundaries — empty string / whitespace / newlines all
   read false; any non-whitespace char reads true
5. getByPath cases — top-level / array-by-id / unknown / boolean / too
   many dots
6. PROFILE_FIELDS ↔ template alignment, both directions

## Brief notes on the other commits (layer 3 round 2)

### β.4 + β.5 — wolf actually starts using profile.toml

**β.4 (read path)**:
- `FileProfileRepositoryImpl` gains `getProfileToml(name)` returning
  the structured object directly.
- Old `getProfileMd / getResumePool / getStandardQuestions` now read
  profile.toml and render markdown via `profileTomlRender.ts`.
  Existing markdown-input consumers (tailor, cover letter writer)
  don't change — they think they're getting .md, but it's rendered
  from .toml.
- `init` no longer writes the three .md files; only profile.toml.

**β.5 (write commands)**:
- Adds `wolf profile show / get / set / add / remove / fields`.
- Each routes through `ProfileApplicationService`.
- `set` uses β.2's surgical edit to preserve comments.
- `add` generates a new `[[experience]] / [[project]] / [[education]]`
  block; id from slugify or UUID.
- `remove` refuses builtin stories (clear `star_story` to skip).

### β.6 — doctor refactor

Before:
```
read profile.md → stripComments() → extractH2Content('Email') → check empty
```

After:
```
read profile.toml (parsed) → walk PROFILE_FIELDS where required → isFilled(getByPath(toml, path))
```

- PROFILE_FIELDS as source of truth keeps `wolf doctor` and
  `wolf profile fields --required` always in sync.
- Error messages name the dot-path + help text directly, so AI agents
  reading doctor output know the next command to run.
- `assertReadyForTailor` (tailor's preflight) gets the same treatment.

### β.7 — jd.md → SQLite column

Before, `wolf add` wrote JD text to `data/jobs/<dir>/jd.md`. Now it
writes to the `jobs.description_md` column:

```sql
ALTER TABLE jobs ADD COLUMN description_md TEXT NOT NULL DEFAULT '';
```

- ALTER TABLE in `initializeSchema` is idempotent (try/catch for
  duplicate-column).
- `JobRepository.readJdText` → SELECT description_md
- `JobRepository.writeJdText` → UPDATE description_md
- v1→v2 migration walks `data/jobs/<dir>/`, reads jd.md, backs it up
  to `.wolf/backups/v1/jobs/<jobId>.jd.md`, writes to the column,
  deletes the original.

### β.8 — wolf context command

New command `wolf context --for=<scenario>` for AI prompt injection.

- `--for=search`: search-time agent. Outputs job_preferences +
  clearance + experience snapshot + collected user notes. Excludes
  identity / contact / PII / stories (search doesn't need them). Has
  a "how to use this" header (honour hard-rejects, flag sponsorship
  conflicts, etc.).
- `--for=tailor`: chat-wrapped tailor flow. Full profile + full resume
  + filled stories.
- Output is deterministic (same TOML input → same bytes out) so AI
  clients can cache the bundle.

### β.9 — workspace-claude.md rewrite

Each wolf workspace's `CLAUDE.md` / `AGENTS.md` is the AI agent
operations manual. v1's version talked about editing three .md files
and grep'ing callouts. v2:

- "use `wolf doctor` to check" replaces "grep for callouts"
- "use `wolf profile set` to write" replaces "edit the .md file"
- New "three-state answering rule" section (answer / skip-empty /
  explicit-decline)
- New "v1 → v2 migration" pointer
- Full table of profile commands
- Context command intro + "before searching jobs, run
  `wolf context --for=search`" guidance

## Dependency graph

```
α (runner framework)
   │
   └─→ β.3 (v1→v2 migration) registered with runner
              │
              └─→ uses β.2 (surgical edit) to write toml
              └─→ uses β.1 (schema/parser) to validate output

β.1 (schema + parser)
   ├─→ β.4 ProfileRepository uses it to parse profile.toml
   ├─→ β.5 wolf profile commands use getByPath / isFilled
   ├─→ β.6 doctor uses PROFILE_FIELDS + getProfileToml
   └─→ β.8 wolf context uses ProfileToml to render markdown slices

β.2 (surgical edit)
   └─→ β.5 wolf profile set uses it

β.7 (jd.md → SQLite) — independent track, no profile-side coupling
β.9 (workspace-claude.md) — doc, updates usage notes for everything above
```

**β.1 is the keystone** — almost every later commit consumes its types
and functions.

## Current state

- Branch: `feat/migration-runner-framework`
- 12 commits (α + β.1 through β.10c), not pushed
- 326 / 326 tests passing
- Build clean (stable + dev)

### β.10 follow-ups

- **β.10a** Merged `storyFields.ts` into `profileFields.ts`.
- **β.10b** `wolf profile add story --prompt --answer` unlocked
  user-custom behavioral prompts.
- **β.10c** v1 → v2 migration body stubbed (pre-1.0, zero users; the
  runner framework stays, the body is a no-op).
- **β.10d** **PROFILE_FIELDS as template SoT.** Bundled `profile.toml`
  template moved from a hand-written 700-line file to runtime-generated
  string in `profileTomlGenerate.ts`. Per-field `comment` + `defaultValue`
  on `FieldMeta` drive emit; the static template file is deleted.
- **β.10e** **Renderer + search-context loop unification.** Added
  `heading` / `section` / `inSearchContext` to `FieldMeta`.
  `profileTomlRender.ts` and search-context rendering became data-driven
  loops over PROFILE_FIELDS, replacing ~70 lines of hand-rolled
  `pushFieldIfFilled` cliques.
- **β.10f** **Pseudo-enum strings collapsed.** 5 `relocation_*` + 6
  `sponsorship_*` + 4 `clearance.*` → 3 freeform fields.
  `renderRelocationCombined` / `renderSponsorshipCombined` helpers
  deleted. Audit: structured fields had no programmatic consumers.
- **β.10g** **`[form_answers]` + `[[story]]` unified into `[[question]]`.**
  6 form_answers became builtin entries in `WOLF_BUILTIN_QUESTIONS` (now
  23 = 6 short ATS Q&A + 17 STAR). Field `star_story` → `answer`.
  `BuiltinQuestion.defaultAnswer?` carries absorbed verbatim defaults.
  CLI: `wolf profile add story` → `add question`. `parseProfileToml`
  throws on legacy `[[story]]` to prevent silent data loss.
- **β.10h** **Job artifact paths → conventions + booleans.** 5 nullable
  string columns dropped → 4 booleans. New
  `JobRepository.getArtifactPath(id, kind)` resolves paths from
  convention. `hasX = true` means "wolf produced", not "file on disk".
- **β.10i** **Skills 5→1 + notes inline.** `skills.*` 5 sub-fields →
  `skills.text`. Every `<table>.note` renders inline at end of its H1
  block; the separate `## User notes` extract is gone.
- **β.10j** **Salary low/high + dynamic salary_expectation.**
  `Job.salary` → `salaryLow` + `salaryHigh`. `salary_expectation` static
  default removed; fill computes from JD range at runtime.
- **β.10k** **Unpaid sentinel removed.** `Salary` → `number`. Convention:
  `0` = explicit unpaid, `null` = unknown. `low=0 + high=N` valid.
  Reviewer-flagged rename residue swept (`addStory` → `addQuestion`,
  `buildStoryBlock` → `buildQuestionBlock`,
  `checkStoriesAndFormAnswers` → `checkQuestions`, `# Stories` H1 →
  `# Q&A`).

### `wolf job` CLI surface (added with β.10h)

- `wolf job show <id>` — full row + JD prose + company name
- `wolf job get <id> <field>` — pipe-friendly read
- `wolf job set <id> <field> <value>` — surgical update via
  `JobRepository.update`; coerces per `JOB_FIELDS`
- `wolf job fields [name]` — schema reference; `--required` / `--json`

`JOB_FIELDS` mirrors `PROFILE_FIELDS`'s SoT pattern: 18 editable
fields with `enum` / `boolean` / `number` / `nullableEnum` types and
explicit help. System-managed fields (`id` / `companyId` / `createdAt`
/ `updatedAt`) refused by `set`.

### Field-level audit

`docs/dev/FIELDS_AUDIT.md` snapshots every wolf-defined field as of
β.10k. Includes profile flat tables, profile arrays (experience /
project / education / question), the 23 builtin questions with default
answers, 18 editable Job columns, and a §5 "review status" tracking
each audit prompt's resolution.

## What's NOT done (β.10 + leftovers)

- New profile / job CLI surface in acceptance test groups (only smoke
  has init + list)
- Multi-profile end-to-end tests
- Reviewer items deferred from β.10k:
  - Negative salary acceptance — could add `n >= 0` guard
  - Reversed range (low > high) detection — doc-only for now
  - `salary_expectation` runtime computation contract → DECISIONS.md
    (will pin when M4 fill prompt lands)
