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
