# Changelog

All notable changes to wolf are recorded here. wolf follows
[semantic versioning](https://semver.org/) (with the `0.x` caveat: minor
version bumps may include breaking changes until `1.0`).

## Unreleased — `feat/m2-score-ai-only` branch (M2 score, tier-based v3)

### Added

- **`wolf score`** lands as the first Milestone-2 deliverable (CLI + HTTP).
  AI emits one of four tiers — `skip` / `mass_apply` / `tailor` /
  `invest` — plus pros/cons markdown. Tier names are stored in TypeScript
  (`src/utils/scoringTiers.ts`); SQL stores the integer index.
  - CLI flags: `--profile`, `--jobs`, `--single`, `--poll`, `--ai-model`.
    Default mode submits every unscored (`tierAi: null`) job to the
    Anthropic Batch API; `--single` triages one job synchronously for
    inline AI-orchestrator presentation; `--poll` drains pending score
    batches (idempotent via `batch_items.consumed_at`).
  - HTTP route `POST /api/score` mirrors the CLI 1:1. Body matches
    `ScoreOptions`, response matches `ScoreResult` (`singleTier`,
    `singleTierName`, `singleMd`). 503 if the score app is not wired,
    400 on schema violation.
  - **Two tier columns per Job**: `tier_ai` (AI verdict, written by
    `wolf score`) and `tier_user` (manual override, written by `wolf job
    set <id> tierUser <name|index>`). AI never overwrites user; user
    actions never invalidate AI history. Effective tier =
    `tierUser ?? tierAi`.
  - **Profile-level scoring guide**: new file `profiles/<name>/score.md`,
    bootstrapped with a `> [!TODO]` placeholder by `wolf init`. Edited
    via `wolf profile score show / edit / init`. Merged into the
    score-system prompt at scoring time so users can give the AI
    long-form steering.
  - `job_preferences.hard_reject_companies` and
    `job_preferences.precision_apply_companies` (already existed) double
    as `skip` and `invest` signals — the score-system prompt names them
    explicitly. No code-side dealbreaker filter; the AI is told what the
    lists mean.
  - MCP tool `wolf_score` is intentionally **not yet wired** in this PR.

### Schema

- `jobs` table grew two columns: `tier_ai INTEGER`, `tier_user INTEGER`
  (idempotent ALTER TABLE for upgrades).
- `Job.score` (0..1 numeric) is **deprecated** — kept for backward-compat
  with v1 workspaces; new code neither reads nor writes it. Will be
  dropped after the migration framework lands.

### Test infra

- Smoke group `test/smoke/groups/score/` (4 deterministic cases: help,
  missing API key, missing profile, empty `--poll`).
- Acceptance group `test/acceptance/groups/score/` promoted from
  "Planned" to "Implemented". 3 cases: mocked single tier write-back,
  malformed response surfaces score_error, paid live tier-quality review.
  Reviewer rubric at `test/acceptance/reviewers/score-artifact-review.md`.
- Dev-only `WOLF_TEST_AI_RESPONSE_FILE` env-var hook: when set in a dev
  build, `aiClient` returns the file's contents instead of calling
  Anthropic. AC tests use it to assert tier write-back without spending
  money. Stable user builds ignore the env var.

### Repository

- New `BatchRepository.listCompletedByType(type)` for per-type apply
  loops (drains unconsumed score items left over from prior poll runs).
- New `ProfileRepository.getScoreMd / writeScoreMd / ensureScoreMd` for
  the profile-level scoring guide.

### Follow-ups (not in this PR)

- `wolf job unlock <id>` shortcut for clearing `tier_user` (today: `wolf
  job set <id> tierUser null`).
- `wolf job list --tier <names>` filter.
- Default content for `profiles/<name>/score.md` (today: just a
  `> [!TODO]` placeholder).
- MCP tool wiring for `wolf_score`.

## Unreleased — `feat/migration-runner-framework` branch

Schema-shape work building on top of the v2 single-file profile (β.1–.10c
already shipped). All breaking changes follow the **pre-1.0 hard-cut**
policy — no automated migration written; users on a fresh `wolf init`
see the new shape immediately, and `parseProfileToml` throws a clear
"rename / re-init" error if it sees any pre-β.10g data.

### Breaking changes

- **`profile.toml`: collapsed pseudo-enum string fields into freeform prose** (β.10f):
  - `[job_preferences]` `relocation_within_metro` / `relocation_within_state`
    / `relocation_cross_country` / `relocation_international` /
    `relocation_free_text` (5) → `relocation_preferences` (1 freeform).
  - `[job_preferences]` `sponsorship_h1b` / `sponsorship_green_card` /
    `sponsorship_cpt` / `sponsorship_opt` / `sponsorship_none` /
    `sponsorship_free_text` (6) → `sponsorship_preferences` (1 freeform).
  - `[clearance]` `has_active` / `level` / `status` / `willing_to_obtain`
    (4) → `clearance.preferences` (1 freeform).
- **`profile.toml`: `[form_answers]` table merged into `[[question]]`** (β.10g):
  - 6 form_answers (work auth, sponsorship, willing-to-relocate, salary
    expectation, "how did you hear", "when can you start") became builtin
    entries in `WOLF_BUILTIN_QUESTIONS` (renamed from `WOLF_BUILTIN_STORIES`
    — now 23 entries: 6 short ATS Q&A + 17 STAR behavioral).
  - Field rename: `star_story` → `answer`. Storage rename:
    `[[story]]` → `[[question]]`. CLI: `wolf profile add story` →
    `wolf profile add question`. Dot-paths: `story.<id>.star_story` →
    `question.<id>.answer`.
- **`profile.toml`: `[skills]` 5 sub-fields collapsed to 1** (β.10i):
  - `skills.languages` / `frameworks` / `tools` / `domains` / `free_text`
    → `skills.text` (single freeform).
- **`profile.toml`: per-table `*.note` fields render inline now** (β.10i):
  - Notes attach to their parent H1 block in tailor context instead of
    being extracted to a separate `## User notes` block.
- **`jobs` table: artifact paths → booleans + convention paths** (β.10h):
  - 5 nullable string columns (`tailored_resume_pdf_path`, `cover_letter_html_path`,
    `cover_letter_pdf_path`, `screenshot_path`, `outreach_draft_path`)
    dropped. 4 booleans added (`has_tailored_resume`,
    `has_tailored_cover_letter`, `has_screenshots`, `has_outreach_draft`).
  - New `JobRepository.getArtifactPath(id, kind)` resolves the path from
    convention (`<workspaceDir>/resume.pdf` etc.) on demand.
- **`jobs.salary` → `salary_low` + `salary_high`** (β.10j/k):
  - Single column became two range endpoints. The `"unpaid"` string
    sentinel is **gone**; both fields are plain `number | null`.
    Convention: `0` = explicit unpaid, `null` = unknown / not listed.
    `low=0 + high=N` is valid (e.g. unpaid base + bonus ceiling).

### Added

- `wolf job show <id>` / `wolf job get <id> <field>` /
  `wolf job set <id> <field> [value]` / `wolf job fields [name]` —
  symmetric CLI surface mirroring `wolf profile`. Edits go through
  `JobRepository.update` as single-column patches; reads include the
  `description_md` JD prose. JOB_FIELDS metadata drives `wolf job fields`
  + type coercion (`enum` / `boolean` / `number` / `nullableEnum` etc.).
- `JobRepository.getArtifactPath(id, kind)` — convention-path resolver
  for the 5 per-job artifacts. JSDoc spells out the stale-flag risk
  (`hasX = true` ≠ "file currently on disk"; consumers handle ENOENT).
- `BuiltinQuestion.defaultAnswer?: string` — short verbatim Q&A absorbed
  from form_answers (`how_did_you_hear` defaults to "LinkedIn", etc.)
  carry their pre-seed via this field; `injectMissingBuiltinQuestions`
  applies it on lazy top-up.
- `parseProfileToml`: legacy `[[story]]` array detection. Throws a clear
  rename / re-init error rather than silently letting zod's default-`[]`
  drop the user's STAR answers.
- `docs/dev/FIELDS_AUDIT.md` — review-only snapshot of every wolf-defined
  field (PROFILE_FIELDS, JOB_FIELDS, builtin questions, profile arrays).

### Changed

- `PROFILE_FIELDS` is now the single source of truth: `wolf init`
  template, `wolf profile fields` listing, doctor's required-set, the
  three markdown renderers, and `wolf context --for=search` field
  selection are all driven off the one declaration. Adding a new profile
  field is a single edit + matching zod schema bump (a CI test pins
  the alignment in both directions).
- Renderer loops replace ~70 lines of hand-rolled `pushFieldIfFilled`
  cliques. `renderRelocationCombined` / `renderSponsorshipCombined` /
  `renderSkillsBody` cross-field views deleted (β.10f/i).
- `JobUpdate` widened to cover every editable column. `wolf job set`
  now does single-column UPDATE instead of INSERT-OR-REPLACE on the
  full row (concurrency-safer + cleaner SQL).
- `workspace-claude.md` slimmed: stale v1→v2 migration section dropped,
  redundant JD-prose-on-disk paragraph removed, new job CLI surface
  documented.

## v0.1.0 — 2026-04-28

First stable release on npm: `npm i -g @gerryt/wolf`. Tailor pipeline
(analyst + resume + cover letter writer, 3-agent checkpoint flow) is
the only feature shipped end-to-end. `hunt` / `score` / `fill` / `reach`
are registered but print a clean "not yet available" message and exit.

### Added
- Stable npm package `@gerryt/wolf` published from `package.stable.json`
  via `scripts/publish-stable.sh` (root `package.json` is the dev workspace
  manifest, never published).
- Dev binary `wolf-dev` (separate from stable `wolf`) so dogfooding the
  stable release and iterating on dev can coexist on the same machine.
- `update-notifier` integration — stable users see a one-line banner when
  a newer `@gerryt/wolf` ships (24h cache; never blocks the user's
  command).
- Typed errors: `MissingApiKeyError` (`MISSING_API_KEY`) and
  `MissingChromiumError` (`MISSING_CHROMIUM`). CLI renders these as a
  single stderr line + exit 1 (no stack trace). MCP tool handlers serialize
  them as `{ isError: true, content: [{ text: JSON of { errorCode, ... } }] }`
  so AI orchestrators can branch on `errorCode`.
- `assertApiKey()` guard — tailor (analyze / writeResume / writeCoverLetter
  / full) calls it before any Claude API request, surfacing missing-key
  errors before a confusing 401 bubbles up.
- Chromium auto-install — render service detects a missing
  Playwright Chromium binary on first launch and runs
  `npx playwright install chromium` automatically (with progress streamed
  to the user's terminal). No prompt, no postinstall hook.
- `wolf doctor` reports `WOLF_ANTHROPIC_API_KEY` presence and Playwright
  Chromium presence alongside the existing profile checks.
- `[NOT YET IMPLEMENTED — Mn]` markers on `hunt` / `score` / `fill` /
  `reach` in `wolf --help` so users see the roadmap without surprise.
- `## Workspace migrations` and `## Releasing (stable npm)` sections in
  root `CLAUDE.md` and `AGENTS.md`.

### Changed
- `better-sqlite3`: `^11.9.1` → `^12.9.0` (broader Node 20–25 prebuild
  coverage).
- `playwright`: `devDependencies` → `dependencies` (the render service
  imports `chromium` at runtime).
- README rewrite: 7-step "5-minute" Quick start with explicit profile-fill
  step; dev-build instructions reflect the new `wolf-dev` binary.

### Engines
- Node `>=20.0.0` (drops Node 18 EOL).
