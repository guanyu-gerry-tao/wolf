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
**AI:** `wolf.toml` at the workspace root holds workspace-level settings (providers, `defaultProfileId`, hunt/reach config). Each profile folder (`profiles/<id>/`) holds its own `profile.toml` with per-profile settings (name, email, scoring prefs, immigration status, etc.).
**Result:** Adopted. `wolf.toml` is the workspace entry point; all profile-specific data lives in `profiles/<id>/profile.toml`. Commands that need profile data read `wolf.toml` to find the active profile ID, then `FileProfileRepository` loads the corresponding `profile.toml`.

---

**2026-04-04 — Auto-compress resume to one page via binary search on layout parameters**
**Me:** After Claude tailors the resume content, the output may overflow to a second page, requiring another LLM call to ask it to shorten things. Proposed a binary-search approach that adjusts layout parameters (linespread → fontsize → margin) to force one-page output without touching the content.
**AI:** Validated. Content layer stays with Claude; layout layer handled deterministically. Binary search over linespread (0.85–1.0), fontsize (9.5–11), and margin (0.3–0.5 in) converges in ~15–18 xelatex compilations — seconds, no extra API calls. Adjustments ordered by visual impact: linespread first (least disruptive), margin last. `microtype` included in the template as a static fallback. If all three steps fail, surface a `failed` status and ask the user to cut content manually; no silent failure.
**Result:** Adopted for Milestone 3 tailor pipeline. Implemented in TypeScript using `child_process.spawnSync` + `xelatex`. Parameters injected via `\def` prepended to `\input{resume.tex}`. Page count read via `pdfinfo`. See GitHub issue for implementation spec.

---

**2026-03-25 — Added `portfolioPath` and `transcriptPath` to `UserProfile`; read-only, PDF only**
**Me:** Portfolio and transcript should be tracked per-profile like `resumePath`, but wolf should never modify them.
**AI:** Both fields follow the same per-profile pattern as `resumePath` (stored in `UserProfile`, configurable in `wolf init`). Key constraints enforced by convention and validated at init time: (1) read-only — wolf may attach or reference these files but must never write to them; (2) PDF only — no `.tex` or other formats accepted.
**Result:** Adopted. `portfolioPath: string | null` and `transcriptPath: string | null` added to `UserProfile`. `wolf init` prompts for both (skippable, validated for `.pdf` extension). Unlike `resumePath`, these fields have no tailoring pipeline and will never gain one.

---

**2026-04-11 — Layered DDD architecture replacing flat utility-based structure**
**Me:** The flat architecture (commands calling utils directly) made testing hard and layers unclear. Proposed a DDD-style refactor before M2 work begins.
**AI:** Proposed six layers: Types → Repository → Service → Application → Commands → Presentation. Each layer depends only downward. `AppContext` acts as the manual DI container — the single construction point for all concrete implementations. No DI framework needed.
**Result:** Adopted. Implemented in PRs #62, #63. Old `src/utils/db.ts` replaced by `src/repository/` layer. New `src/service/` layer added. `src/application/` reserved for use-case orchestration (M2+). All old issues referencing the flat architecture closed as `not_planned`.

---

**2026-04-11 — AppContext as manual DI container**
**Me:** Asked how dependency injection should work without a framework.
**AI:** Manual constructor injection via a single `AppContext` object in `src/cli/appContext.ts`. All concrete implementations (repositories, services) are instantiated there and passed down. Swapping real for mock = changing one file. TypeScript `implements` enforces interface compliance at compile time.
**Result:** Adopted. `AppContext` is the only place that `new`s concrete classes. Commands and application services receive dependencies via constructor, never instantiate them.

---

**2026-04-11 — `profiles/<id>/` at workspace root, not inside `data/`**
**Me:** The earlier design put profiles inside `data/<profileId>_<label>/`. But `data/` is gitignored (generated artifacts). Profile content (resume pool, personal config) should be committable for multi-machine sync.
**AI:** Split workspace into two top-level directories: `profiles/` (user-authored, committable) and `data/` (generated artifacts, gitignored). `profiles/<id>/profile.toml` + `profiles/<id>/resume_pool.md` sit at workspace root, not inside `data/`.
**Result:** Adopted. `FileProfileRepository` reads `profiles/<id>/profile.toml` and `profiles/<id>/resume_pool.md`. `data/` contains only `wolf.sqlite` and generated PDFs/screenshots.

---

**2026-04-11 — Zod for runtime validation of TOML files**
**Me:** wolf.toml and profile.toml are user-edited files. Without runtime validation, missing or wrong-type fields cause silent runtime errors or cryptic crashes.
**AI:** Zod schemas (`AppConfigSchema`, `UserProfileSchema`) defined in `src/utils/schemas.ts`. Both `config.ts` (wolf.toml) and `FileProfileRepository` (profile.toml) call `.parse()` at load time. Missing fields or wrong types throw immediately with a clear Zod error.
**Result:** Adopted. Schemas defined in `src/utils/schemas.ts`. Config and repository load paths both validate at parse time, not at first use.

---

**2026-04-12 — HTML rendering over LaTeX for M3 resume output**
**Me:** The POC validated HTML → PDF via Playwright. Compared to LaTeX, it removes the xelatex system dependency and the HTML/CSS approach is faster to iterate on.
**AI:** Validated. The `fit()` binary search algorithm (ported from POC to `RenderService`) handles single-page compression deterministically. Claude outputs the HTML body; the shell and CSS are static. No xelatex dependency for users.
**Result:** Adopted for M3. `RenderServiceImpl` wraps Playwright + `fit.ts`. Resume body is HTML; shell is `src/service/impl/render/shell.html`. LaTeX path is removed from M3 scope.

---

**2026-04-16 — Three-agent checkpoint flow for tailor (analyst + writers)**
**Me:** Original tailor called one resume agent and one cover-letter agent, each reading pool+JD independently. Output drift: the resume emphasized projects A, B, C while the cover letter emphasized A, D, E — two voices about the same candidate.
**AI:** Split into three agents with a shared decision artifact. Agent 1 (analyst) reads pool+JD and produces a Markdown tailoring brief (selected roles, 2-3 projects, 3 core themes, cover-letter angle). Agents 2 and 3 (resume writer, CL writer) read the brief + pool + JD and run in parallel. Agents 2/3 use system prompts that point at the brief as source of truth for selections. Considered JSON for the brief — rejected because both consumers are LLMs and prose is native to them; schema-enforcement YAGNI.
**Result:** Adopted. New `TailoringBriefService` sits in `src/service/`. `TailorApplicationService` exposes four methods — `tailor` (orchestrates all three), `analyze` (brief only), `writeResume`, `writeCoverLetter` — so users can run partial steps, edit `data/<jobId>/src/tailoring-brief.md`, and re-run writers without re-analyzing. Optional `hint.md` (with `//` header stripped by `stripComments`) lets users or outer AI agents steer the analyst before it runs. Cost: +1 AI call per job (~3s, Haiku-suitable for analyst). Consistency gain justifies it.

---

**2026-04-18 — Prose on disk, SQLite for metadata only**
**Me:** Job descriptions and company info were living in SQLite text columns. That works, but prose in a database is awkward: not greppable from the filesystem, not hand-editable, and not diffable. Meanwhile the profile layer already stores prose on disk (`resume_pool.md`) with SQL for structured fields only — jobs and companies should follow the same pattern.
**AI:** Validated. Move JD text to `data/jobs/<dir>/jd.md` and company info to `data/companies/<dir>/info.md`. SQLite keeps only structured/queryable columns. `JobRepository` gains `getWorkspaceDir` / `readJdText` / `writeJdText`; `CompanyRepository` gains `getWorkspaceDir` / `readInfo`. Directory naming: `<safeLabel(company)>_<safeLabel(title)>_<shortId(jobId)>` and `<safeLabel(company)>_<shortId(companyId)>` — human-readable plus 8 hex chars for disambiguation. `info.md` is auto-created on company upsert with a `//` self-doc header; never overwritten. Rejected alternative: a separate `JobDescriptionRepository` — splits by file type, scales combinatorially as per-job prose files grow. Escalation path if that bloat appears: extract a `JobWorkspaceRepository` later.
**Result:** Adopted. `Job.description` removed from types and schema. `SqliteJobRepositoryImpl` now takes `(db, companyRepository, workspaceDir)` so it can resolve company name for directory composition (aggregate-root pattern matching `ProfileRepository`). Path composition lives in `src/utils/workspacePaths.ts` with unit tests.

---

**2026-04-18 — Structured logger: JSONL file + stderr console, not SQLite**
**Me:** Needed a real logger before M2 lands. Started with the usual level-list question (`debug` / `info` / `warn` / `error` vs adding `trace` / `critical`), but the more important question turned out to be *where the logs live*. I considered a SQLite log table — same DB as the domain data, queryable with SQL.
**AI:** Rejected SQLite for logs. Different concerns, different write profiles. A SQLite log table causes (1) schema rigidity — adding a field means ALTER TABLE; (2) write contention — SQLite locks the DB file, so the MCP server and CLI commands would contend on log writes; (3) entangled lifecycles — you can't truncate logs without touching domain data; (4) crash safety — half-committed SQL transactions vs. a partial JSONL line; (5) industry mismatch — every observability tool (Loki, Datadog, CloudWatch, etc.) expects line-delimited JSON. Proposed: two sinks, one logger. Console sink writes to **stderr** (not stdout — stdout is reserved for command deliverables so `wolf job ls | grep open` stays clean, and MCP uses stdout for protocol frames). File sink writes to `data/logs/wolf.log.jsonl` — one JSON object per line, `jq`/`grep` friendly, future-shippable to a real log system. Four levels adopted (`debug` / `info` / `warn` / `error`); `fatal`/`critical` folded into `error` because the "terminate" decision belongs to the caller, not the log level. Structured from day one: `logger.info('msg', { jobId, ... })` produces `{ts, level, msg, ...fields}` — JSON is the internal event shape, pretty rendering is just one projection of it.
**Result:** Adopted. `src/utils/logger.ts` defines `Logger`, `LogEvent`, `LogSink` interfaces plus `createConsoleSink`, `createFileSink`, `createMemorySink` (tests), and `createSilentLogger` (test AppContext). `AppContext.logger` wires a console + file sink in production; `createTestAppContext()` uses the silent logger. Env vars: `WOLF_LOG=debug|info|warn|error` (default `info`), `WOLF_LOG_FORMAT=pretty|json` (default `pretty`, file sink is always JSON). SQLite schema is untouched — logs are file-only by design.

---

**2026-04-18 — Nouns over god-views: split `wolf status` into dashboard + per-noun `list`**
**Me:** Worried that every new feature (outreach, hunt, fill, etc.) would force me to edit `wolf status` to show its extra state — classic god-view that rots fast. Also worried about terminal overflow: 1000 hunted jobs dumped into the shell would be unusable.
**AI:** Two problems, one fix — stop growing `status` with every feature. Grow *nouns* instead. `wolf status` becomes a dashboard of aggregate counts, where each module registers one `StatusCounter` in the registry (`{ label, count: () => Promise<number> }`). New feature = one registry entry; no edit to the status command, service, or other counters. Per-noun list commands (`wolf job list`, later `wolf company list`, `wolf outreach list`) own filter-and-inspect duties. This is the shape every mature CLI follows (`git`, `kubectl`, `docker`, `gh`). Overflow is handled by the list-command convention below (default limit 20, explicit `--limit`, `--json` for piping). SQL aggregation queries at this scale are microseconds — don't optimize prematurely.
**Result:** Adopted. `src/application/statusApplicationService.ts` defines `StatusApplicationService`, `StatusCounter`, `StatusSummary`. `StatusApplicationServiceImpl` fans out over the registry with `Promise.all`; one counter's failure returns `count: 0` + inline `error` string (logged as warn) so a single broken counter can't kill the whole dashboard. Registry is built in `appContext.ts` — initial counters are `tracked` / `tailored` / `applied`; hunt/fill/reach will register their own when they ship. `wolf job list` replaces the old `wolf status` list semantics. See the companion 2026-04-18 entry below for the final shape of list commands.

---

**2026-04-18 — Standard shape for `wolf <noun> list` commands**
**Me:** With `wolf job list` just landing and `wolf company list` / `wolf outreach list` obviously coming, I didn't want every list command to reinvent its own flag shape. Also the first cut of `wolf job list` had two smells I wanted to fix before they spread: per-field filter flags (`--company`, later `--title`, …) that grow forever, and a `--company` implementation that loaded every company row and substring-filtered in JS.
**AI:** Two-part convention for every future `wolf <noun> list`:

*Universal flags:*
- `--search <text>` — case-insensitive substring, repeatable. Multiple `--search` flags OR at the top level. No query-language syntax (`|`, `&`, etc.) — shell conflicts + slippery slope into a DSL. Adding more terms = adding more flags.
- `--start <date>`, `--end <date>` — ISO-8601 or `YYYY-MM-DD`; normalized to canonical ISO at the command boundary.
- `--limit <n>` — default **20**. No `--all` escape hatch. Users who truly want more run `wolf status` for the total, then pass `--limit <n>`.
- `--json` — machine-readable output.

*Searchable fields per command:* `--search` matches **prose-like text fields** only — names, titles, locations, descriptions. Enums/IDs/URLs/structured fields get their own dedicated flags when warranted. For `wolf job list`: `jobs.title`, `companies.name` (via LEFT JOIN), `jobs.location`. For `wolf company list` (future): `companies.name`, `companies.industry`, `companies.headquartersLocation`. JD content (`data/jobs/<dir>/jd.md`) is **not** searched — the data-layout refactor put it on disk, so anyone who really needs it runs `grep -l X data/jobs/*/jd.md`.

*Filtering is always SQL-side.* Never `repository.query({})` + JS substring scan. `JobQuery.search: string[]` and `CompanyQuery.nameContains: string` are the new repo-level fields; `buildConditionsWithSearch()` in `sqliteJobRepositoryImpl.ts` wraps each search term in an `or(like(title), like(location), like(companies.name))` and joins the companies table only when search is present, so non-search queries stay a plain `SELECT FROM jobs`.

*Input validation at the command boundary.* Bad input (`--status bogus`, `--start not-a-date`, blank `--search ""`) throws with a clear message, never silently returns zero rows. `ALL_JOB_STATUSES` from `types/job.ts` is the source of truth; the derived `JobStatus` type and the validator share it so typos can't drift from the union.
**Result:** Adopted. `wolf job list` ships with this exact shape today (see AC-08). Future list commands inherit the convention by reference. Escalation paths deferred until they're needed: Zod-izing validators across every command; SQLite FTS5 for JD content search; cursor pagination if `--limit` ceiling starts biting.

---

**2026-04-24 — Dev/stable isolation for AI-orchestrated acceptance tests**
**Me:** Acceptance tests need to run shell-level `wolf` commands through AI agents, but the same machine also has real dogfood data. Tests must not touch `~/wolf`, `~/wolf-dev`, repo `data/`, or shell RC files.
**AI:** Adopted two build modes with separate defaults. Stable builds come from `npm run build`, read `WOLF_*`, and default to `~/wolf` or `WOLF_HOME`. Dev builds come from `npm run build:dev`, read `WOLF_DEV_*` first with fallback to `WOLF_*`, and default to `~/wolf-dev` or `WOLF_DEV_HOME`. Local dev invocation is `npm run wolf -- <command>`. Automated acceptance tests must always set `WOLF_DEV_HOME=/tmp/wolf-at-<ID>` and only create/delete paths under `/tmp/wolf-at-*`.
**Result:** Adopted. `src/utils/instance.ts` owns build-mode, workspace, env namespace, and dev warning behavior. `wolf init --empty --dev` creates schema-valid dev workspaces for agents. Dev CLI output includes a warning, and dev MCP tools use `wolfdev_*` names plus a structured warning field.

---

**2026-04-25 — Cover letter renders at natural layout, not single-page fit (Bug B2)**
**Me:** First end-to-end acceptance run flagged `CannotFillError` blocking every cover-letter render: a 250-word letter at default font produced ~545px of content on a 960px page, even max section-gap + max font (14pt) couldn't reach the 95% fill threshold. The fit algorithm treats "short" as a hard caller error ("ask the model to add filler material and retry") — but cover letters are intentionally concise. Re-prompting Claude to pad them would degrade quality. Conceptually: a one-page resume must be one page (recruiters skim), but cover letters don't share that constraint. Less than a page is fine; if the content genuinely needs to flow to a second page that's fine too. Recruiters read cover letters end-to-end.
**AI:** Drop the fit loop for cover letters and render at natural CSS-driven layout. The interface JSDoc on `RenderService.renderCoverLetterPdf` already documented this contract ("without the fit algorithm, natural layout preferred"); the implementation was the lie. Refactor `RenderServiceImpl` so resume keeps `fit()` (and its `CannotFitError` / `CannotFillError` paths) and cover letter goes through a new `renderHtmlToPdfNatural` path: load shell → inject body → wait for fonts → `page.pdf({ printBackground: true, preferCSSPageSize: true })`. The shell's `@page` rule + existing `page-break-inside: avoid` on h1/h2/h3 + `widows`/`orphans: 2` on p give acceptable multi-page pagination without further work. Cover-letter prompt drops the hard "must fit on one page" line and softens to a 250-300 word target with explicit permission for whitespace or page-two flow. Acceptance run that surfaced this: `test/runs/acceptance-20260425-163454/`.
**Result:** Adopted. `RenderServiceImpl` now has two paths — `renderResumePdfFit` (resume) and `renderHtmlToPdfNatural` (cover) — sharing only the prelude (`loadShellPage`). `renderCoverLetterPdf` no longer throws `CannotFitError` / `CannotFillError`. Three regression tests added: cover letter buffer return, no `CannotFillError` on short content, no `CannotFitError` on long content. Architecture diagrams updated to mark cover letter as "natural layout (no fit loop)".
