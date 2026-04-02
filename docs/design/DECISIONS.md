# Decision Log — wolf

Decisions made during Milestone 1 are reconstructed retrospectively from commit history and conversation logs. From Milestone 2 onwards, decisions are tracked in real time as GitHub Issues with the `decision` label.

---

**2026-03-17 — Docs before code**
**Me:** Write architecture and milestones before any source code.
**AI:** Validated. Forces explicit decisions upfront; gives contributors a map.
**Result:** Adopted. All docs written before first `.ts` file.

---

**2026-03-18 — SQLite as communication bus**
**Me:** Commands shouldn't call each other. Share state via database?
**AI:** Validated. Also added: crash recovery and `wolf status` fall out naturally.
**Result:** Adopted. SQLite is the only shared state between commands.

---

**2026-03-18 — CLI + MCP share the same commands layer**
**Me:** Don't want to write logic twice for CLI and MCP.
**AI:** Thin wrapper pattern — `src/commands/` holds logic, CLI/MCP are adapters.
**Result:** Adopted. Interface-agnostic core from day one.

---

**2026-03-18 — JobProvider plugin pattern**
**Me:** Sources were hardcoded. I raised that LinkedIn, Handshake, email alerts, and manual entry all work differently in practice — no single ingestion strategy fits all.
**AI:** Proposed the `JobProvider` abstraction. New source = one new file, no changes to `hunt.ts`.
**Result:** Adopted. Also surfaced `BrowserMCPProvider` and `ManualProvider` as valid sources I hadn't initially planned for.

---

**2026-03-18 — Company as a first-class entity**
**Me:** Job-level data isn't enough. Many students only target a fixed set of companies — that's a watchlist, not a job field. Needed a second entity.
**AI:** Validated. Also added: `reach` needs `Company.domain` for email pattern inference; a stable `companyId` enables the scoring boost for targeted companies.
**Result:** Adopted. `Company` became its own table. `Job.companyId` is a foreign key.

---

**2026-03-18 — Multi-profile support**
**Me:** Users may need multiple personas — different names, emails, or immigration statuses for different applications (ATS workarounds, multi-tenancy).
**AI:** Validated. Proposed `profiles[]` + `defaultProfileId` + tracking `appliedProfileId` per job so you know which identity was used.
**Result:** Adopted. Each profile has its own resume, contact info, immigration status, and scoring config.

---

**2026-03-18 — Hybrid scoring: algorithm + AI**
**Me:** Pure AI scoring is slow and expensive. Is there a better way?
**AI:** AI handles only `roleMatch` (semantic fit). Algorithm handles the rest (location, salary, auth, size). Dealbreakers filter before scoring to skip AI calls entirely.
**Result:** Adopted. Cheaper, faster, and more debuggable than pure AI scoring.

---

**2026-03-18 — Jest → Vitest**
**Me:** Jest can't mock ESM modules cleanly. Mocking is a core need for AI-integrated tests.
**AI:** Known rough edge. Vitest handles ESM and mocking natively, drop-in replacement.
**Result:** Switched. Migration took one commit, no further issues.

---

**2026-03-18 — TDD as AI hallucination guardrail**
**Me:** Planning to open-source. Need a standard that works for all contributors, including those using AI to write code.
**AI:** TDD enforces a contract before implementation. For AI-integrated features, tests with mocked bad responses act as hallucination guardrails — AI-generated code must pass them.
**Result:** Adopted as a project-wide rule, documented in CONTRIBUTING. Standardizes the AI coding workflow for all contributors.

---

**2026-03-18 — Revert shared AI client utility**
**Me:** Should we have a centralized `ai.ts` wrapper?
**AI:** Worth trying, but each command's prompting needs are too different to generalize.
**Result:** Reverted. Commands call the Anthropic SDK directly. Wrapper can be revisited if patterns emerge.

---

**2026-03-19 — When to open-source**
**Me:** Open-source the project now and invite classmates to contribute.
**AI:** Not yet — empty repo won't attract contributors. Finish Milestone 1 skeleton first so there's something to run.
**Result:** Agreed. Will open for contributions once `wolf --help` and `wolf mcp serve` are functional.

---

**2026-03-19 — Decision log**
**Me:** Write a decision log to document the AI-augmented workflow for readers.
**AI:** Agreed. Reviewed commit history, drafted 12 entries in the format: Me → AI → Result.
**Result:** This file.

---

**2026-03-20 — pwd-based workspace instead of `~/.wolf/`**
**Me:** Users should be able to store config, resume, and generated files in any folder they choose — not hidden in `~/.wolf/`. Running `wolf init` in the current directory should make that directory the workspace.
**AI:** Validated. Also noted this aligns perfectly with AI agent workflows — Claude Code's working context is the open folder, so keeping wolf's workspace there eliminates cross-directory jumps and permission issues.
**Result:** Adopted. `wolf init` creates `wolf.toml` and `.env` in pwd. All commands look for `wolf.toml` in pwd. Generated files (tailored resumes, screenshots, drafts) go into subdirectories of the workspace. `~/.wolf/` removed entirely.

---

**2026-03-20 — Record design decisions in DECISIONS.md**
**Me:** Claude should remind me to record significant design decisions as they happen.
**AI:** Agreed. Added a workflow rule to CLAUDE.md.
**Result:** Rule added. This entry is the meta-example.

---

**2026-03-21 — MCP stub handlers are synchronous; async restored at implementation time**
**Me:** `wolf_tailor` hung with no response when called from Claude Desktop — unhandled rejected promise from the stub's `throw new Error('Not implemented')`.
**AI:** Stub handlers don't need to call the underlying command at all. Making them synchronous eliminates the async path entirely and cannot hang. Added `TODO(M2)` comments to mark where each handler should be replaced with `async/await` when the command is implemented.
**Result:** Adopted for all four command tools. `wolf_status` remains async because it actually reads `wolf.toml` and environment variables.

---

**2026-03-20 — API keys in shell env vars, not `.env` in workspace**
**Me:** The workspace directory will likely be cloud-synced (iCloud/OneDrive) or zipped and shared alongside resume files. A `.env` file there is a leak waiting to happen.
**AI:** Agreed. Shell environment variables never enter the workspace. `WOLF_` prefix added to namespace keys away from other tools. `wolf env show` / `wolf env clear` added for discoverability and cleanup.
**Result:** Adopted. `wolf init` no longer creates `.env`. All keys read from `process.env.WOLF_*`. Users set keys in `~/.zshrc` (Mac/Linux) or Windows User Environment Variables.

---

**2026-03-21 — Separated `wolf hunt` (ingest) and `wolf score` (process) into two commands**
**Me:** `wolf hunt` was doing too much — fetching, filtering, and scoring in one blocking call. Wanted scoring to run independently, on a schedule, or triggered by an agent.
**AI:** Ingest and scoring operate at different rates: hunt may run hourly or on-demand; scoring runs async after batch results arrive. Separating them makes each independently automatable.
**Result:** Adopted. `wolf hunt` fetches raw jobs and saves with `score: null`. `wolf score` reads unscored jobs, extracts structured fields via AI, applies dealbreakers, then submits to Claude Batch API. Both exposed as CLI commands and MCP tools.

---

**2026-03-22 — Added `wolf add` as a manual job ingestion entry point for AI orchestrators**
**Me:** There was no way for an AI (Claude/OpenClaw) to handle the case where a user shares a job they found online — screenshot, pasted JD, or URL content. Considered `wolf add` as a CLI command but the UX would be painful (user can't type structured JSON or paste a screenshot).
**AI:** wolf is primarily operated through AI orchestrators, not by users typing commands directly. The AI already has the user's raw content and can extract structure from it. `wolf add` should be an MCP-only interface that accepts already-structured data — the AI caller does the extraction, wolf does the storage. Tool description must make this division explicit.
**Result:** Adopted. `wolf_add` added as an MCP tool (no CLI equivalent). AI extracts `{ title, company, jdText, url? }` from user input before calling. wolf stores the job and returns a `jobId` for the AI to chain into `wolf_score` or `wolf_tailor`.

---

**2026-03-22 — `wolf score --single` for synchronous immediate scoring via Haiku**
**Me:** After `wolf add`, the AI should be able to immediately score the job and present results to the user — not wait for an async batch.
**AI:** Batch API exists for cost savings on bulk jobs. For a single user-initiated job, synchronous Haiku is the right call: seconds instead of minutes/hours, and the marginal cost difference is negligible for one job.
**Result:** Adopted. `ScoreOptions.single: true` skips the Batch API and calls Haiku synchronously. Default remains batch for bulk scoring.

---

**2026-04-02 — Jobs/evaluations DB split**
**Me:** The jobs table was conflating objective JD facts (title, company, raw JD, structured fields) with subjective, profile-specific data (score, filter decision, selection, status). A job's facts don't change; its evaluation depends entirely on which profile is scoring it.
**AI:** Validated. Proposed splitting into two tables: `jobs` (immutable JD cache, profile-agnostic) and `evaluations` (profile-specific: score, filterDecision, filterReason, scoreJustification, selected, status, tailoredResumePath). A job scored by two profiles produces two evaluation rows but only one jobs row.
**Result:** Adopted. `jobs` stores only objective facts. `evaluations` stores all subjective and profile-linked state. Foreign keys: `evaluations.jobId → jobs.id`, `evaluations.profileId → profiles.id`.

---

**2026-04-02 — Multi-profile: expandable but deferred**
**Me:** Revisiting the 2026-03-18 multi-profile decision. Full multi-profile support is out of scope for now, but the architecture should not prevent it later.
**AI:** The jobs/evaluations split already handles the core requirement. For commands that touch evaluations (`wolf score`, `wolf tailor`, `wolf list`), an optional `--profile <profileId>` arg routes to the correct evaluation row. Without the flag, wolf reads `default_profile` from `wolf.toml` and uses that. No other changes needed to support multiple profiles when the time comes.
**Result:** Adopted. Multi-profile implementation deferred. `wolf.toml` gains a `default_profile` field (set to `"default"` by `wolf init`). All evaluation-touching commands accept an optional `--profile` arg. The 2026-03-18 entry's scope is narrowed accordingly.

---

**2026-04-02 — Two-TOML config split: `wolf.toml` (workspace) + `profile.toml` (per-profile)**
**Me:** Global workspace settings and per-profile settings should live in separate files. A single `wolf.toml` conflates things that change at different scopes.
**AI:** `wolf.toml` at the workspace root holds workspace-level settings (providers, `default_profile`, DB path). Each profile folder (`data/<profileId>_<label>/`) holds its own `profile.toml` with per-profile settings (name, email, resume path, scoring prefs, immigration status, portfolioPath, transcriptPath).
**Result:** Adopted. `wolf.toml` is the workspace entry point; all profile-specific data lives in `profile.toml` inside the profile's folder. Commands that need profile data read `wolf.toml` to find the active profile ID, then load the corresponding `profile.toml`.

---

**2026-03-25 — Added `portfolioPath` and `transcriptPath` to `UserProfile`; read-only, PDF only**
**Me:** Portfolio and transcript should be tracked per-profile like `resumePath`, but wolf should never modify them.
**AI:** Both fields follow the same per-profile pattern as `resumePath` (stored in `UserProfile`, configurable in `wolf init`). Key constraints enforced by convention and validated at init time: (1) read-only — wolf may attach or reference these files but must never write to them; (2) PDF only — no `.tex` or other formats accepted.
**Result:** Adopted. `portfolioPath: string | null` and `transcriptPath: string | null` added to `UserProfile`. `wolf init` prompts for both (skippable, validated for `.pdf` extension). Unlike `resumePath`, these fields have no tailoring pipeline and will never gain one.
