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
**Result:** Adopted. `src/utils/instance.ts` owns build-mode, workspace, env namespace, and dev warning behavior. `wolf init --preset empty` creates schema-valid dev workspaces for agents. Dev CLI output includes a warning, and dev MCP tools use `wolfdev_*` names plus a structured warning field.

---

**2026-04-25 — Cover letter renders at natural layout, not single-page fit (Bug B2)**
**Me:** First end-to-end acceptance run flagged `CannotFillError` blocking every cover-letter render: a 250-word letter at default font produced ~545px of content on a 960px page, even max section-gap + max font (14pt) couldn't reach the 95% fill threshold. The fit algorithm treats "short" as a hard caller error ("ask the model to add filler material and retry") — but cover letters are intentionally concise. Re-prompting Claude to pad them would degrade quality. Conceptually: a one-page resume must be one page (recruiters skim), but cover letters don't share that constraint. Less than a page is fine; if the content genuinely needs to flow to a second page that's fine too. Recruiters read cover letters end-to-end.
**AI:** Drop the fit loop for cover letters and render at natural CSS-driven layout. The interface JSDoc on `RenderService.renderCoverLetterPdf` already documented this contract ("without the fit algorithm, natural layout preferred"); the implementation was the lie. Refactor `RenderServiceImpl` so resume keeps `fit()` (and its `CannotFitError` / `CannotFillError` paths) and cover letter goes through a new `renderHtmlToPdfNatural` path: load shell → inject body → wait for fonts → `page.pdf({ printBackground: true, preferCSSPageSize: true })`. The shell's `@page` rule + existing `page-break-inside: avoid` on h1/h2/h3 + `widows`/`orphans: 2` on p give acceptable multi-page pagination without further work. Cover-letter prompt drops the hard "must fit on one page" line and softens to a 250-300 word target with explicit permission for whitespace or page-two flow. Acceptance run that surfaced this: `test/runs/acceptance-20260425-163454/`.
**Result:** Adopted. `RenderServiceImpl` now has two paths — `renderResumePdfFit` (resume) and `renderHtmlToPdfNatural` (cover) — sharing only the prelude (`loadShellPage`). `renderCoverLetterPdf` no longer throws `CannotFitError` / `CannotFillError`. Three regression tests added: cover letter buffer return, no `CannotFillError` on short content, no `CannotFitError` on long content. Architecture diagrams updated to mark cover letter as "natural layout (no fit loop)".

---

**2026-04-25 — Resume sections are honest (pool-driven), and order is the user's call (Bug B3)**
**Me:** Same acceptance run flagged the resume writer fabricating an `Education: BS, Computer Science` row when the resume pool had no education entry. The natural fix sounded like "treat Education as required and reject if missing," but that's wrong on inspection — bootcamp grads have no degree, first-job seekers have no Experience yet, an applicant with everything in `## Experience` has no separate `## Projects`, and `## Skills` is genuinely optional too. There is no universal "required" section. The contract should be: pool decides what exists, in what order, with what wording. The writer is honest — it never invents, never omits, never reorders.
**AI:** Rewrite `tailor-system.md` so the writer's first step is an inventory of the pool (which `## Headers` actually have content), and its output rules are: emit one `<h2>` per section in the SAME order as the pool, using the EXACT title text the user wrote (`## Work Experience` stays "Work Experience", not normalized to "Experience"), and never invent a section the pool doesn't contain. Visual styling — UPPERCASE rendering, font, color — is the template's CSS responsibility (`text-transform: uppercase` on `h2` already handles this), so the writer never decides casing. Per-section content rules (3-bullet hard limit on Experience-style sections, 1-line on optional sections, etc.) constrain density but are explicitly NOT a list of "must exist". Update `init/index.ts` resume-pool template with a "Section honesty + ordering" `//` self-doc header so users know their order is authoritative. Strengthen AC-04-2 to explicitly cover (1) no invented sections and (2) section order follows pool. Acceptance case: `tailor/TAILOR-04-section-honesty.md` with two sub-cases — 4a (pool with no Education must produce a resume with no Education) and 4b (pool ordered Skills → Projects → Experience → Education must produce a resume in that exact order, NOT reordered to convention). Unit-level guard: `resumeCoverLetterService` test verifies the service returns writer HTML verbatim — no service-layer section injection. Acceptance run that surfaced this: `test/runs/acceptance-20260425-163454/`.
**Result:** Adopted. Tailor system prompt rewritten end-to-end: removed the hardcoded "Required HTML structure" template that listed Experience / Projects / Education / Skills as fixed slots; replaced with an inventory-then-emit flow. Resume-pool template carries a new `//` header explaining ordering authority and section optionality. `AC-04-2` strengthened in `ACCEPTANCE_CRITERIA.md` (and `_zh`) with the two new clauses. `TAILOR-04-section-honesty.md` (and `_zh`) added under tailor group. Coverage matrix updates `AC-04-2` row to point at TAILOR-01 + TAILOR-04. Pre-flight section guard, `--skip-section` CLI flag, and a separate "checker" agent were considered and explicitly rejected: the writer prompt is the natural place to enforce structural honesty, and adding deterministic guards on top of a no-longer-required-sections model would just re-introduce a "this section must exist" concept through the back door.

---

**2026-04-25 — Resume `CannotFillError` is correct behavior; the test fixture was lying (B2-bis)**
**Me:** Acceptance run #3 (after the B2 + B3 fixes) flagged a new `CannotFillError`, this time on the **resume** render. Initially looked like B2 spreading from cover letter to resume. On inspection it isn't: the B3 fix (no fabricated sections) made test-fixture resumes legitimately short — only 5 bullets across 2 roles, no Education, no Projects, no Skills. The fit algorithm correctly noticed it could not reach the 95% fill threshold even at max section-gap + max font, and refused. Question: is "refuse" the right default? **Yes.** A one-page resume that fills only ~60% of the page is a bad resume, not a wolf bug. Recruiters skim — half-empty pages signal "not enough experience for this role." If the user genuinely has that little material, wolf should tell them, not silently produce a thin PDF. The right fix is two-part: (a) make the error message user-actionable so the user knows what to add, and (b) fix the test fixture to be a realistic mid-career resume so the renderer's underflow guard is testing against honest material instead of artificially-thin material that depended on B3-era fabrication to "pass".
**AI:** Rewrite `CannotFillError` and `CannotFitError` constructor messages to (1) name the failure mode in plain English ("too short" / "too long"), (2) include concrete diagnostic numbers from the last fit attempt (rendered Npx of Mpx, fill / overflow %), and (3) tell the user exactly what to edit in `resume_pool.md` — with an explicit "wolf will not fabricate content for you" line in the underflow case so the user is not tempted to read it as a softer "ask Claude to add filler" suggestion. Add unit tests in `renderService.test.ts` that pin the message contract: must mention `resume_pool.md`, must include the diagnostic numbers, must NOT mention "fabricate" or "invent". Then beef up the TAILOR-01 fixture pool from 5 bullets / 2 roles to 3 roles + 2 projects + Education + Skills (a realistic mid-career data/backend engineer's resume). TAILOR-04 sub-cases get the same treatment, keeping their structural variations: 4a still has no Education; 4b still has the Skills-first reordered layout. Both are now dense enough that the resulting tailored resume can fill a page on the remaining sections alone. Acceptance run that surfaced this: `test/runs/acceptance-20260425-190008/`.
**Result:** Adopted. `src/service/impl/render/fit.ts` `CannotFillError` / `CannotFitError` messages now carry diagnostic + actionable text. Two new unit tests pin the message shape. TAILOR-01 / `_zh` fixture pool replaced with a realistic dense pool (Northwind + Vega Logistics + Atlas Tools roles, two projects, Education, Skills line); TAILOR-02 / TAILOR-03 inherit it via "use the same setup as TAILOR-01" references. TAILOR-04 4a / 4b pools updated to match density while keeping their structural variations. The renderer's underflow guard remains intentional behavior — the rejected alternatives were "drop fit for resumes too" (loses the single-page guarantee that's the whole point) and "graceful degrade — return best-effort PDF on CannotFillError" (silently produces a thin resume the user did not approve, hides the diagnostic, and trains users that wolf accepts pools that are too thin).

---

**2026-04-26 — Profile migration: typed TOML → three-MD layout (E8)**
**Me:** The typed `profile.toml` + `UserProfileSchema` (zod) shape was fighting the actual use case. Profile content is mostly free-form prose that's read by AI: an address, a "why this role" template, a five-year-plan paragraph. Forcing it through a typed schema meant either (a) every new field needed a schema bump + migration + form prompt, or (b) the schema bloated into a giant grab-bag of `string | null` slots that the AI then had to re-parse anyway. Meanwhile users with a senior career or international background kept hitting "the field doesn't fit" — middle name, multiple citizenships, a relocation preference more nuanced than "yes/no". The schema was also a hostile editing surface: TOML's quoting rules + the implicit-then-strict zod parse meant a stray comma or wrong key killed `wolf init` with a stack trace.
**AI:** Replace `profile.toml` with three sibling Markdown files at `profiles/<id>/`: `profile.md` (identity / contact / address / links / job preferences / demographics / clearance — H1 = category, H2 = field, body = answer), `resume_pool.md` (already MD), `standard_questions.md` (Q&A bank for `wolf fill` — H1 = category, H2 = question, body = answer or framework). Plus an `attachments/` subdirectory for uploadable files. The repository becomes a thin file reader; `Profile` collapses to `{ name, md }`. Validation moves from "schema-shape" to "content-shape": the only contract is that REQUIRED H2 sections under specific H1 categories have a non-empty body after stripping guidance markers, plus `resume_pool.md` has ≥5 substantive lines. This is enforced where it matters — at command time by `assertReadyForTailor` (and per-file by `wolf doctor`) — not at parse time. Trade-offs accepted: lose typed autocomplete on profile fields, gain (1) an editing surface non-engineers can actually use, (2) zero migrations for new fields, (3) AI consumes the prose verbatim with zero reformatting, (4) git diffs are readable.
**Result:** Adopted. PR landed as commit 4511499 with companion follow-ups for name split (legal first/middle/last), pre-filled defaults, EAD purge, and Job Preferences expansion. `UserProfile` and `UserProfileSchema` deleted; `Profile`, `ProfileRepository.getProfileMd / getResumePool / getStandardQuestions / getAttachmentsList` are the new surface. `wolf init` / `wolf init --preset empty` write the three template files instead of one TOML. Acceptance + smoke specs and AC fixtures updated in the same commit chain to match.

---

**2026-04-26 — Marker convention: GitHub Alert blockquotes for runtime-stripped guidance**
**Me:** With the move to free-form prose, we needed a way to ship template guidance ("you must answer this", "leave blank if N/A", "write a flexible template — AI adapts per company") that (a) is invisible to the AI at runtime so it can't get confused, (b) is visible to the user when they edit the file, and (c) ideally renders pleasantly in any Markdown previewer (GitHub, VS Code, Obsidian) so the file reads like a friendly form instead of a raw skeleton. First attempt was HTML comments `<!-- -->` — strip-time visible to the AI (because the build pipeline kept them), invisible to the user in MD preview. Exactly backwards. Second attempt was `//`-prefixed lines — a custom convention nobody renders. Third attempt was plain `>` blockquotes — risky because legitimate user content might also use blockquotes (quoting a JD line, an email, a paragraph from a research paper).
**AI:** Adopt **GitHub Alert blockquotes** (`> [!IMPORTANT]`, `> [!TIP]`, `> [!NOTE]`, `> [!WARNING]`, `> [!CAUTION]`) as the template-guidance convention. Two strip layers: (1) build-time strip of `<!-- ... -->` HTML comments via a custom tsup esbuild plugin — these are reserved for wolf-source-only context that should never reach a user's workspace; (2) runtime strip in `stripComments` of `> [!XYZ]` alert blocks (the head line plus consecutive `>` continuation lines) before any AI read or readiness check. Plain `>` blockquotes are NOT stripped — they're legitimate user content. Use `> [!IMPORTANT]` for REQUIRED fields (user must answer), `> [!TIP]` for guidance / sensible defaults / optional hints. The user sees a styled callout box in any modern previewer; the AI sees a clean H2 with empty body when the user hasn't answered yet (so `assertReadyForTailor` correctly flags it as missing).
**Result:** Adopted. `src/utils/stripComments.ts` final form strips only `> [!XYZ]` blocks — not arbitrary `>`-quotes. `tsup.config.ts` carries a custom esbuild plugin that strips `<!-- ... -->` from `.md` files at bundle time (so the published binary's templates don't carry wolf-internal HTML comments). Templates rewritten end-to-end to use the convention. `wolf doctor` and `assertReadyForTailor` both call `stripComments(md)` BEFORE `extractH2Content` (regression: a bug where a `> [!IMPORTANT]` body was counted as "filled" let fresh `wolf init` profiles report ready=true; fixed at both call sites with regression tests).

---

**2026-04-26 — Tailor robustness: refuse to run on placeholder profile or empty pool**
**Me:** The three-MD migration solved the editing-UX problem but created a new failure mode: a user runs `wolf init` and immediately runs `wolf tailor`, the AI receives a `profile.md` whose REQUIRED H2 bodies are all `> [!IMPORTANT]` callouts and a near-empty `resume_pool.md`, and produces a confidently fabricated resume — wrong name, made-up experience, invented skills. The user might not even notice on a quick skim. Worse: this is silent. The AI doesn't refuse, it just hallucinates.
**AI:** Two-layer defense. **Layer A — strip the temptation:** wrap placeholder examples in `resume_pool.md` (e.g. `### SWE — Acme \n*2024*\n - Built things.`) inside `> [!TIP]` blocks so they get stripped at runtime, leaving the AI with a section header and no body. The AI then has nothing to imitate. **Layer B — runtime gate:** add `assertReadyForTailor` to `tailorApplicationServiceImpl` that runs at the start of every tailor invocation. It checks (1) every REQUIRED H2 in `profile.md` has a non-empty body after `stripComments`, (2) `resume_pool.md` has ≥5 substantive lines (lines that aren't blank, aren't markdown headings, aren't blockquote alerts after strip). If either fails, throw a typed error listing exactly what's missing — never proceed to the AI call. Cost: zero false positives on real profiles; the floor of 5 substantive lines is comfortably below "anyone with anything to say has more than this." Companion proactive surface: `wolf doctor` runs the same checks against all three files and prints a per-file READY/NOT READY report, so users can see the state without invoking tailor.
**Result:** Adopted. `assertReadyForTailor` lives in `src/application/impl/tailorApplicationServiceImpl.ts`; `wolf doctor` lives in `src/commands/doctor/index.ts`. Both share `extractH2Content` + `stripComments`. Unit tests cover: REQUIRED-missing case, callout-only-body case (regression), and the 5-line floor. CLI registers `wolf doctor` and exits 1 when not ready.

---

**2026-04-26 — Shared AC fixtures + git-tracked orchestrator presets with model tiering**
**Me:** Acceptance specs were embedding fixture profile/pool content as inline heredocs — copy-pasted across cases, drifting silently when one case was edited and others weren't. Meanwhile the `.claude/` agent presets were gitignored as personal config, so dispatch logic for smoke/AC orchestrators had to be re-explained in each session, and there was no enforced model tiering between fast smoke runs (where Haiku is plenty) and judgment-heavy AC runs (where Sonnet earns its cost).
**AI:** Two changes, one PR. (1) Move shared profile + resume-pool fixtures to `test/fixtures/wolf-profile/<persona>/{profile,resume_pool}.md`. Two personas to start: `swe-mid` (mid-career backend) and `ng-swe` (F-1 OPT new grad). Acceptance cases reference these via path, never inline. (2) Narrow `.gitignore` from `.claude/` to `.claude/*` + `!.claude/agents/` so agent presets become committable while personal config stays ignored. Add two orchestrator presets: `wolf-smoke-orchestrator.md` (dispatches runners with `model: "haiku"`) and `wolf-acceptance-orchestrator.md` (dispatches with `model: "sonnet"` for cases that need genuine judgment). Both orchestrators themselves run `model: sonnet` because the routing logic is the judgment-heavy part. Use `REPO=$(git rev-parse --show-toplevel)` for paths so presets are portable across machines.
**Result:** Adopted as commit 790d4ee. AC and smoke specs updated to point at fixture paths. `.claude/agents/wolf-{smoke,acceptance}-orchestrator.md` checked in. Run reports under `test/runs/` remain gitignored (run output, not source). This unblocks future contributors from getting the same dispatch behavior without copy-pasting orchestrator instructions into every session.

---

**2026-04-26 — `wolf doctor` for proactive profile readiness**
**Me:** With `assertReadyForTailor` in place, the failure surface moved from "AI hallucinates" to "user runs tailor, sees a typed error, has to read it carefully to know what to fix." That's better but not great — especially for first-time users who don't know what fields exist. Want a one-shot "is my profile ready?" command they can run before invoking the real pipeline.
**AI:** Add `wolf doctor` (no flags) which loads the default profile and reports per-file readiness: `profile.md` (REQUIRED H2s filled), `resume_pool.md` (≥5 substantive lines), `standard_questions.md` (≥3 answered H2s after strip). Each file gets a status line, a list of missing items, and a one-line fix hint. Overall ready/not-ready. Exit 1 when not ready so it composes into shell scripts. Pure functions (`doctor` returns `DoctorReport`, `formatDoctor` renders text) so it's trivially testable. Critical implementation detail: strip callouts BEFORE extracting H2 content (same fix as `assertReadyForTailor`); without this, `> [!IMPORTANT]` template bodies count as "filled" and fresh `wolf init` profiles incorrectly report READY.
**Result:** Adopted as commit 90a0621. `src/commands/doctor/index.ts` exports `doctor()` + `formatDoctor()`. Registered in `src/cli/index.ts`. Eight unit tests cover happy path, each per-file failure, the callout-only regression, and formatter output. Help string lists `doctor` between `init` and `hunt`. Smoke verified: a freshly initialized empty workspace prints NOT READY listing every REQUIRED field; a manually-filled fixture prints READY.

---

**2026-04-27 — Strict layer refactor (v2): kill `commands/` as a layer, route every verb through application**
**Me:** PR #77 left wolf with a partial layering: simple commands (`config get/set`, `env show`, `profile list/use`, `init`) lived in `src/commands/<verb>/index.ts` and did their work inline. Heavy commands (`tailor`, `status`) already routed through `src/application/`, but the asymmetry was a constant question — "does this need an application service?" — and a foothold for new logic to creep into the wrapper. v1 of the refactor toyed with a parallel `admin/` directory for the small commands; that just renamed the inconsistency. Want a single rule: every CLI verb, even three-line ones, calls `ctx.<verb>App.<method>(opts)` and nothing else.
**AI:** Strict five-layer architecture. Move `src/cli/appContext.ts` → `src/runtime/appContext.ts` (CLI and MCP both consume it). Fold `src/types/` and `src/errors/` into `src/utils/` (cross-cutting helpers, types, errors all under one umbrella). Promote `src/utils/ai/` → `src/service/ai/` (AI is a domain capability, not a helper). Flatten `src/commands/` from 13 sub-directories into `src/cli/commands/<verb>.ts` flat files (job stays a folder because of `wolf job list` and future `job get/info`). Extract one `*ApplicationService` per verb — including `add`, `config`, `env`, `profile`, `doctor`, `init`, `job` (previously inline) — plus stub interfaces for `hunt`, `score`, `fill`, `reach` (M2/M4/M5) so `appContext` can register them now and the milestones drop in real impls without re-wiring. Templates for `wolf init` move to `src/application/impl/templates/`. The two stateless wrappers that can't take a full `AppContext` (`init` runs before `wolf.toml` exists; `env` has zero DB deps and tests can't afford to open SQLite under the wolf project root) instantiate their application service as a module singleton — same logic-in-application rule, ergonomic exception for bootstrap.
**Result:** Adopted in commits `5640b8e..b3xxxxx` on `refactor/layer-v2`. Six phases, 13 atomic commits. Build green at every step; tsc shows only the 5 pre-existing `any` errors in `job-list.test.ts`. New `AppContext` exposes 13 `*App` services. `src/commands/` deleted; `cli/index.ts` and `mcp/tools.ts` import from `cli/commands/<verb>.ts`. Layer rule simplified to one sentence: _"every CLI command — even three-line ones — routes through an application service; nothing is inlined in the wrapper."_


---

**2026-04-28 — Stable npm distribution as `@gerryt/wolf`; dev binary kept as `wolf-dev`**
**Me:** Need to dogfood wolf with friends while still actively refactoring. Stable users want `npm i -g wolf` simplicity; my own dev environment must keep iterating without affecting them. Constraint: both binaries must coexist on my laptop (one stable from npm, one dev from clone). Open questions: package name, version scheme, how to ship Chromium, what to do about unimplemented commands like `hunt`/`fill`, how to gate publishes, how to detect new versions.
**AI:** Adopt scoped name `@gerryt/wolf` (skip the contested unscoped `wolf`). Two-line bin: stable publishes `bin: { wolf }`, root dev `package.json` is `private: true` with `bin: { "wolf-dev" }`. The stable manifest `package.stable.json` lives in the repo and is *copied* into a staged `dist-package/` at publish time — root `package.json` is never mutated by the publish flow (rejected the sed-rewrite approach as fragile and the dual-bin approach as polluting stable users' PATH). First version `0.1.0` matches current state (tailor full pipeline works; M2/M4/M5 are stubs). Hunt/score/fill/reach stay registered in `--help` with `[NOT YET IMPLEMENTED — Mn]` markers and stub action handlers (clean stderr + exit 1, no stack trace) — hiding them entirely would leave AI orchestrators confused about scope. Workspace template (`AGENTS.md`/`CLAUDE.md`) gets a Command status table mirroring `src/utils/commandStatus.ts` so AI agents in the workspace know what to suggest. `better-sqlite3` bumped to `^12.9.0` for Node 20–25 prebuild coverage; `engines.node >=20`. `playwright` moves to `dependencies` (render service imports `chromium` at runtime). Chromium binary not bundled — render service auto-installs on first launch via `npx playwright install chromium` with `stdio: 'inherit'`, no prompt (non-technical users shouldn't be quizzed). Two new typed errors `MissingApiKeyError` and `MissingChromiumError` route through CLI top-level catch + MCP tool handler with `isError: true` + `errorCode` so AI orchestrators can branch. `wolf doctor` extended to report API key + Chromium presence. `update-notifier` integrated (cached, forked, ~1 RTT/day, skipped in dev builds). Publish hard-gated by (a) full smoke + acceptance including paid groups, (b) git tag matching version, (c) `CHANGELOG.md` updated, (d) main branch + clean tree. `scripts/publish-stable.sh` enforces (b) and (d) and stops *before* `npm publish` so the human runs the final command (which triggers npm 2FA).
**Result:** Adopted in PR1 `feat/runtime-hardening` (typed errors, guards, update-notifier, dep moves) and PR2 `feat/npm-publish-prep` (bin separation, `package.stable.json`, publish script, command-status system, README + workspace template + this DECISIONS entry). Migration framework deliberately deferred to the first breaking change; `CLAUDE.md` § Workspace migrations records the contract so future-self can't forget. PR plan recorded at `docs/plans/2026-04-28-npm-dual-line-release.md`.

---

**2026-04-30 — Profile prompt packs expose strategy, not runtime protocol**
**Me:** I want users and AI assistants to customize how a profile is positioned, but not to break the tailor/fill pipeline by editing prompts that describe input sections, output schemas, HTML/JSON contracts, or parser/renderer requirements. The useful customization surface is strategy: conservative vs aggressive tailoring, resume style, cover-letter naming preferences, and form-answer strategy. Flow/protocol instructions must remain owned by wolf.
**AI:** Split prompts into two layers. Runtime protocol prompts stay bundled in code and continue to define machine contracts: which prompt sections exist, what names they have, what shape the model must output, and which constraints the renderer/parser depends on. Each profile gets an optional strategy prompt pack at `profiles/<name>/prompts/`, with stable filenames and empty-by-default files: `tailoring-strategy.md`, `resume-strategy.md`, `cover-letter-strategy.md`, and `fill-strategy.md`, plus a README explaining the boundary. Empty strategy files mean "use wolf defaults." Users may edit file contents but must not rename files. Tooling exposes only the skeleton: `wolf profile prompts path`, `wolf profile prompts list`, and `wolf profile prompts repair`; repair creates missing files without overwriting edits.
**Result:** Adopted as the design direction. Initial implementation commit `01fdab8` creates the prompt-pack skeleton and CLI inspection/repair tools, but does not yet feed strategy files into runtime AI calls and does not seed any opinionated strategy content. Future prompt wiring should inject non-empty strategy files as user strategy sections while keeping protocol prompts internal.

---

**2026-05-01 — Base AI batch persists normalized item results before business consumption**
**Me:** I want a base AI batch layer that every future batch workflow can reuse (`score`, input extraction, tailor, etc.), not a score-specific implementation. The tricky part is what happens after provider polling: different services may poll or consume at different times, and results can be partially successful.
**AI:** Split batch lifecycle from business interpretation. `BatchService` owns provider submission, provider polling, and durable normalized results. It stores one row per provider batch in `batches` and one row per request/result in `batch_items`. `batch_items` records `custom_id`, item status, normalized text output or error, and `consumed_at`. The base layer does not parse score JSON, validate resume HTML, or update job fields; application services consume successful `batch_items` later and write domain state. Provider-specific APIs stay behind adapters such as Anthropic Message Batches, which translate `custom_id`, provider statuses, JSONL rows, content blocks, and provider errors into wolf-owned types.
**Result:** Adopted for the base batch runtime. This keeps polling dumb and resumable, supports partial item failure, survives process restarts, and avoids coupling the batch layer to score/tailor/input semantics. Future business services should treat `batch_items.result_text` as their input and mark rows consumed only after their own writes succeed.

---

**2026-04-30 — `wolf serve` is a parallel HTTP transport, not the new CLI backend**
**Me:** The companion extension needs a persistent local daemon, but should that make the whole project HTTP-first, with CLI/MCP becoming HTTP clients?
**AI:** Keep CLI, MCP, and HTTP as peer entry points. `wolf serve` is a long-running local HTTP daemon for browser extension calls, but it delegates to the same application services through `AppContext`; it does not replace the in-process CLI/MCP path. The CLI still runs without requiring a daemon, preserving one-shot command ergonomics and the existing workspace semantics.
**Result:** Adopted. `src/serve/` holds the local HTTP daemon interface, `ServeApplicationService` owns the daemon lifecycle, and `src/cli/commands/serve.ts` remains a thin wrapper. The initial route is `GET /api/ping`, which echoes a nonce for the companion extension connection check.

---

**2026-04-30 — Inbox is a raw-only landing zone**
**Me:** The inbox must accept both manual companion-extension captures and large hunt results without becoming another processed job workspace.
**AI:** Keep inbox raw-only, but store it in SQLite `inbox_items` instead of `data/inbox/` folders so manual captures and mass hunt results share one durable queue.
**Result:** Adopted. No cleaned JD, parsed fields, tailor artifacts, dedupe output, or fill snapshots live in inbox. User-triggered paid processing creates `background_ai_batches`; successful AI output is immediately applied to canonical job state, with only short-lived debug payloads retained.

---

**2026-05-04 — Score uses 4-tier verdict + pros/cons, not 0–10 numeric (supersedes "AI-only numeric" entry below)**
**Me:** A single 0–1 score from the AI (the v1 design that landed earlier today on this branch) felt off in two ways. (a) The number is a decision dressed up as a measurement — what users actually want is to know whether to skip, mass-apply, tailor, or invest. The score then has to be interpreted into one of those buckets every time anyone reads it. (b) The AI was being asked to do open-ended reasoning to produce a number, which is cognitively harder than picking one of N labels and is more likely to drift between runs. Considered v2 (rubric TOML with positive / negative weights per criterion) but it added a lot of complexity — hash invalidation, reconcile loops, in-flight batch invalidation, criterion editing — for a problem that's really "decide which bucket".
**AI:** Drop both v1 (single numeric score) and v2 (rubric TOML). Have the AI emit a discrete tier from a fixed list plus a short pros/cons markdown blob. The tier is a *decision* — it tells downstream commands what action to take. Pros/cons are the explanation — a user or a future agent can see at a glance why the verdict was picked. Tier names live in TypeScript (`TIER_NAMES`); SQL stores integer indices so renaming a tier doesn't migrate data and reordering is a maintainer-only operation. Two tier columns: `tierAi` (AI verdict) and `tierUser` (manual override); AI never writes `tierUser`, user actions never invalidate `tierAi`. Effective tier = `tierUser ?? tierAi`. The v1 numeric `Job.score` column stays for backward-compat and is no longer read or written.
**Result:** Adopted as v3, replacing v1 mid-PR. AI prompt asks for `<tier>...</tier><pros>...</pros><cons>...</cons>`. Parser maps the tier name to an index 0..3 and assembles a canonical `## Tier / ## Pros / ## Cons` markdown into `Job.scoreJustification`. CLI surfaces a 4-tier model directly: `wolf score`, `wolf score --single`, `wolf score --poll`, `wolf job set <id> tierUser <name|index>`, `wolf profile score show/edit/init`. The hard-reject and precision-apply company lists in `job_preferences` (already existed) double as `skip` and `invest` signals — the score-system prompt names them explicitly.

---

**2026-05-04 — (superseded by tier model above) Score is AI-only; "dealbreakers" are user prose (supersedes §2026-03-18 hybrid scoring)**
**Me:** The 2026-03-18 plan ran code-side dealbreakers (hard_reject_companies, salary floor, sponsorship matrix, remote preference, clearance) before any AI call, then asked the model only to produce `roleMatch`. Now profile is free-form prose (β.x rewrite), so the same intent — "skip Bay Area onsite", "never recommend Palantir", "I want at least $130k" — is already expressed in `job_preferences.scoring_notes`. Maintaining a parallel code path that re-encodes those rules duplicates intent and drifts from the prose.
**AI:** Drop the code dealbreakers. Feed the full profile (especially `scoring_notes`) plus the job posting into one scoring prompt; let the model emit a single score and a justification. Modern Claude is reliable enough at honoring scoring_notes when the rubric says so explicitly. Two practical wins: one source of truth for the candidate's preferences (the prose), and one less abstraction layer to keep in sync as profile fields evolve.
**Result:** Adopted. `wolf score` does no code-side filtering; `Job.status` stays `new` after scoring (status is the user-pipeline state, score is a property). The AI is prompted in a 0–10 scale for natural-language reasoning and the parser normalizes to `[0.0, 1.0]` for storage. `ScoreResult.filtered` stays in the type signature (always `0`) for backward compatibility; downstream commands like `wolf tailor` decide thresholds. The `score_extraction_error` JobError variant is unused under this design but kept reserved.
