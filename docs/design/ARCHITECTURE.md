# Architecture — wolf

## Overview

wolf is a multi-interface application: it runs as a **CLI tool** (for human users), an **MCP server** (for AI agents like OpenClaw), and a local **HTTP daemon** (`wolf serve`) for the companion browser extension. All interfaces share the same application services, ensuring consistent behavior regardless of how wolf is invoked.

```
        Human (terminal)          AI Agent (OpenClaw)       Browser Extension
               │                          │
               v                          v
        ┌─────────────┐          ┌────────────────┐          ┌──────────────┐
        │  CLI Layer  │          │   MCP Layer    │          │ HTTP Layer   │   Presentation
        │ commander.js│          │   MCP SDK      │          │ wolf serve   │
        └──────┬──────┘          └───────┬────────┘          └──────┬───────┘
               └────────────┬────────────┴────────────┬────────────┘
                            │                         │
                            v                         v
               ┌────────────────────────┐
               │       Commands         │   Commands
               │  tailor / hunt / score │
               │  fill / reach / ...    │
               └────────────┬───────────┘
                            │
                            v
               ┌────────────────────────┐
               │       Workflows        │   Workflows
               │  tailor pipeline       │
               │  fitToOnePage          │
               │  score pipeline        │
               └────────────┬───────────┘
                            │
                            v
               ┌────────────────────────┐
               │       Services         │   Services
               │  compile / rewrite     │
               │  scoring / email       │
               └────────────┬───────────┘
                            │
                            v
        ┌──────────┬─────────────┬────────────┬─────────┐
        │  Claude  │   SQLite    │ Playwright │  Gmail  │   Utils + External
        │   API    │             │ (Chromium) │   API   │
        └──────────┴─────────────┴────────────┴─────────┘
```

## Layered Architecture

wolf is structured in five layers. Each layer may only depend on the layers below it — never sideways or upward.

```
┌──────────────────────────────────────────────────────┐
│  Presentation  src/cli/  src/mcp/  src/serve/        │
│  Parse args/protocol, format output. CLI and HTTP    │
│  wrappers delegate to application services.          │
├──────────────────────────────────────────────────────┤
│  Application   src/application/                      │
│  Use-case orchestration. Multi-step pipelines.       │
│  Every command — even three-line ones — routes here. │
├──────────────────────────────────────────────────────┤
│  Service       src/service/                          │
│  Single-responsibility domain operations.            │
│  AI calls, external APIs, rendering.                 │
├──────────────────────────────────────────────────────┤
│  Repository    src/repository/                       │
│  Data access — SQLite (Drizzle) + workspace files.   │
│  Interface per entity; impl/ for concrete backends.  │
├──────────────────────────────────────────────────────┤
│  Utils         src/utils/                            │
│  Cross-cutting helpers, types/, errors/. Not a layer │
│  in the dependency sense — anything may import it.   │
└──────────────────────────────────────────────────────┘

AppContext (src/runtime/appContext.ts) — manual DI container, shared by CLI, MCP, and serve HTTP.
```

**Layer dependency direction:** `cli / mcp / serve → application → service → repository → utils`

### Layer responsibilities

| Layer | Directory | Does | Does NOT |
|---|---|---|---|
| **Utils** | `src/utils/` (with `types/`, `errors/`) | Cross-cutting helpers (logger, config, env, parseModelRef); shared domain types; typed error classes | Contain command logic or hold state |
| **Repository** | `src/repository/` | Read/write SQLite (via Drizzle) and workspace files (`profile.toml`, `score.md`, prompt strategy files, `attachments/`) | Contain business logic or call other layers |
| **Service** | `src/service/` (incl. `service/ai/`) | Single-responsibility operations (AI provider registry + clients, external API fetch, rendering, batch submit) | Orchestrate multi-step flows or access DB directly |
| **Application** | `src/application/` | Orchestrate every use-case — even one-line ones like config get/set or env list. Owns init templates. | Know about CLI options, MCP schemas, or terminal formatting |
| **Presentation** | `src/cli/` (`index.ts` + `commands/<verb>.ts`), `src/mcp/`, `src/serve/` | Parse input/protocol, format output, hold inquirer prompts, expose local HTTP routes | Contain logic beyond argument mapping, protocol mapping, and formatting |

### Dependency injection — AppContext

All concrete implementations are constructed in `src/runtime/appContext.ts`. `src/cli/`, `src/mcp/`, and `src/serve/` consume the same `AppContext`. Nothing else instantiates repositories or services directly. This is the single swap point: change a real implementation for a mock by editing `appContext.ts` — nothing else changes.

```typescript
// src/runtime/appContext.ts
export interface AppContext {
  // repositories
  jobRepository: JobRepository;
  companyRepository: CompanyRepository;
  batchRepository: BatchRepository;
  backgroundAiBatchRepository: BackgroundAiBatchRepository;
  inboxRepository: InboxRepository;
  profileRepository: ProfileRepository;
  // services
  batchService: BatchService;
  httpServer: HttpServer;
  // ...renderService, rewriteService, briefService, fillService, ...
  // application services (one per CLI verb)
  addApp: AddApplicationService;
  configApp: ConfigApplicationService;
  doctorApp: DoctorApplicationService;
  envApp: EnvApplicationService;
  fillApp: FillApplicationService;
  huntApp: HuntApplicationService;
  initApp: InitApplicationService;
  jobApp: JobApplicationService;
  profileApp: ProfileApplicationService;
  reachApp: ReachApplicationService;
  scoreApp: ScoreApplicationService;
  statusApp: StatusApplicationService;
  tailorApp: TailorApplicationService;
  inboxApp: InboxApplicationService;
  inboxPromotionApp: InboxPromotionApplicationService;
  backgroundAiBatchWorker: BackgroundAiBatchWorker;
  serveApp: ServeApplicationService;
}
```

### Dev and stable instances

wolf has two build modes so development and acceptance testing cannot mutate
real dogfood state by accident.

| Mode | Build | Invocation | Default workspace | Env namespace | MCP tools |
|---|---|---|---|---|---|
| stable | `npm run build` | `wolf ...` | `~/wolf` or `WOLF_HOME` | `WOLF_*` | `wolf_*` |
| dev | `npm run build:dev` | `npm run wolf -- ...` | `~/wolf-dev` or `WOLF_DEV_HOME` | `WOLF_DEV_*`, fallback `WOLF_*` | `wolfdev_*` |

`src/utils/instance.ts` is the source of truth for build mode, workspace
resolution, env-var lookup, and the dev warning. Acceptance tests must override
the dev workspace with
`WOLF_DEV_HOME=/tmp/wolf-test/<suite>/<run-id>/workspaces/<workspace-id>` for
every command and must only create/delete paths under `/tmp/wolf-test/`.

### Directory structure

```
src/
├── cli/                                # Presentation — commander.js
│   ├── index.ts                            # CLI entry; registers every subcommand
│   └── commands/                           # one file per verb (hunt.ts, tailor.ts, ...)
│       ├── job/                            # multi-subcommand verbs get a folder
│       └── __tests__/                      # CLI-edge tests
├── mcp/                                # Presentation — MCP SDK (shares AppContext)
├── serve/                              # Presentation — local HTTP daemon
│   ├── httpServer.ts                       # Interface for wolf serve
│   ├── protocol.ts                         # HTTP request/response schemas
│   └── impl/nodeHttpServerImpl.ts          # Node HTTP implementation
├── runtime/
│   └── appContext.ts                       # Manual DI — wires every repo + service + app
├── application/                        # Use-case orchestration
│   ├── <name>ApplicationService.ts         # interface
│   └── impl/
│       ├── <name>ApplicationServiceImpl.ts # implementation
│       └── templates/                      # init workspace markdown templates
├── service/                            # Domain services
│   ├── ai/                                 # provider registry + family modules
│   ├── <name>Service.ts                    # interface
│   └── impl/
│       ├── prompts/                        # system prompts (analyst / writers / fill)
│       ├── render/                         # shell.html + fit() loop
│       └── <name>ServiceImpl.ts
├── repository/                         # Data access
│   ├── <name>Repository.ts                 # interface
│   └── impl/
│       ├── drizzleDb.ts                    # DrizzleDb type alias
│       ├── schema.ts                       # Drizzle table definitions
│       ├── initializeSchema.ts             # CREATE TABLE IF NOT EXISTS
│       ├── sqlite<Name>RepositoryImpl.ts
│       └── fileProfileRepositoryImpl.ts    # Reads profiles/<id>/ on disk
└── utils/                              # Cross-cutting helpers
    ├── types/                              # Shared domain types
    ├── errors/                             # Typed custom error classes
    ├── config.ts                           # wolf.toml read (AppConfigSchema.parse)
    ├── env.ts                              # WOLF_* env vars
    ├── instance.ts                         # build-mode + workspace resolution
    ├── logger.ts                           # structured logging
    ├── schemas.ts                          # Zod schemas for TOML validation
    └── parseModelRef.ts                    # "anthropic/claude-sonnet-4-6" → AiConfig
```

### Example: tailor flow across layers (3-agent checkpoint pipeline)

```
CLI parses --job abc123 [--hint "focus on ML ops"]
  → [Command] tailor({ jobId, hint })
      → [Application] TailorApplicationService.tailor({ jobId, hint })
          → prepareContext → loadJob, loadProfile, loadResumePool, readJdText(jobId), getWorkspaceDir(jobId)
          → ensureHintFile → write data/jobs/<dir>/src/hint.md if absent or if --hint given
          → [Service] TailoringBriefService.analyze(pool, jd, profile, aiConfig, hint)
              → Anthropic API → returns Markdown brief
          → writeFile data/jobs/<dir>/src/tailoring-brief.md
          → Promise.all:
              → [Service] ResumeCoverLetterService.tailorResumeToHtml(pool, jd, profile, brief, ai)
                  → Anthropic API → returns HTML body
                  → [Service] RenderService.renderPdf(html)       # Playwright + fit() binary search
                  → writeFile data/jobs/<dir>/{src/resume.html, resume.pdf}
              → [Service] ResumeCoverLetterService.generateCoverLetter(pool, jd, profile, brief, ai)
                  → Anthropic API → returns HTML body
                  → [Service] RenderService.renderCoverLetterPdf(html)  # Playwright, natural layout (no fit loop)
                  → writeFile data/jobs/<dir>/{src/cover_letter.html, cover_letter.pdf}
      → ctx.jobRepository.update(jobId, { hasTailoredResume: true, hasTailoredCoverLetter: true })
      → return { tailoredPdfPath, coverLetterHtmlPath, coverLetterPdfPath, ... }
        # β.10h: Job row stores booleans only; paths are convention-derived
        # via JobRepository.getArtifactPath(id, kind). The CLI return value
        # still echoes the actual paths for the caller's convenience.
  → CLI prints JSON summary
```

Each step can also be invoked standalone: `wolf tailor brief`, `wolf tailor resume`, `wolf tailor cover`.
Writer-only steps read the brief from disk and error clearly if it is missing.

### Data layout — prose on disk, metadata in SQLite

`data/` is split by entity. SQLite holds structured fields only; any free-form
prose (JD text, company notes, analyst brief, resume/cover HTML, PDFs) lives
as plain files under a per-entity directory. This makes the workspace
grep-friendly and lets users hand-edit any checkpoint.

```
data/
├── wolf.sqlite                             ← structured metadata + JD prose (jobs.description_md, β.7+)
├── jobs/
│   └── <company>_<title>_<jobIdShort8>/    ← per-job artifact dir; β.10h paths convention-derived
│       ├── src/
│       │   ├── hint.md                     ← // comment header + user guidance
│       │   ├── tailoring-brief.md          ← analyst output; editable checkpoint
│       │   ├── resume.html                 ← resume writer output
│       │   └── cover_letter.html           ← CL writer output
│       ├── resume.pdf                      ← final
│       └── cover_letter.pdf                ← final
└── companies/
    └── <company>_<companyIdShort8>/
        └── info.md                         ← free-form employer notes (auto-created)
```

Dir names embed the first 8 hex chars of the UUID for local disambiguation;
non-alphanumeric chars in labels are replaced with `_`. Repositories resolve
these paths internally: `JobRepository.getWorkspaceDir(jobId)`,
`JobRepository.readJdText(jobId)`, `CompanyRepository.readInfo(companyId)`.

## Design Principles

1. **Interface-agnostic core** — Command logic lives in `src/application/`, never in `src/cli/` or `src/mcp/`. CLI and MCP are thin wrappers that parse input, call the application service, and format output.
2. **Shared types as contracts** — `src/utils/types/` defines the data shapes (Job, Resume, AppConfig) that every layer depends on. This is the single source of truth.
3. **Fail-safe by default** — Destructive operations (form submission, email sending) require explicit flags (`--send`, without `--dry-run`). Default behavior is always preview/dry-run.
4. **Local-first data** — All job data, configs, and tailored resumes are stored locally. No cloud dependency for core state.

## Layer Details

### 1. CLI Layer (`src/cli/`)

Entry point for human users. Built with **commander.js**.

```
src/cli/
├── index.ts          # CLI entry point, registers all commands
└── commands/         # Thin command wrappers plus adjacent CLI-edge tests
```

**Responsibilities:**
- Parse command-line arguments and flags
- Call the corresponding application service via the shared `AppContext`
- Format return values for terminal display (tables, colors, progress bars)
- Handle interactive prompts (e.g. `wolf init` wizard)

**Does NOT contain:** Business logic, API calls, data access.

**Entry point:** `wolf` (symlinked via `package.json` `bin` field)

### 2. MCP Layer (`src/mcp/`)

Entry point for AI agent consumers. Built with **MCP SDK**.

```
src/mcp/
├── server.ts         # MCP server setup and lifecycle
└── tools.ts          # Tool definitions with typed input/output schemas
```

**Responsibilities:**
- Start/stop MCP server (`wolf mcp serve`)
- Define tool schemas (name, description, input JSON Schema, output JSON Schema)
- Map incoming tool calls to CLI/application wrappers that share the same runtime behavior
- Return structured JSON results (no terminal formatting)

The MCP layer registers tools with build-aware names: stable builds use `wolf_*`, dev builds use `wolfdev_*`. Current base tools are `hunt`, `add`, `score`, `tailor`, `fill`, `reach`, and `status`; some remain not-yet-implemented roadmap surfaces. Input/output schemas are defined in `src/mcp/tools.ts`.

### 3. CLI command wrappers (`src/cli/commands/`)

One file per verb. Each wrapper is a single delegate line that calls
`ctx.<verb>App.<method>(opts)` plus an optional formatter for terminal output.
Business logic lives in the corresponding `*ApplicationService` — never inline.

```
src/cli/commands/
├── add.ts            # → ctx.addApp.add(opts)
├── config.ts         # → ctx.configApp.get/set
├── doctor.ts         # → ctx.doctorApp.run + formatDoctor
├── env.ts            # → singleton EnvApplicationService (env has no DB deps)
├── fill.ts           # → ctx.fillApp.fill (stub-M4)
├── hunt.ts           # → ctx.huntApp.hunt (stub-M2)
├── init.ts           # → singleton InitApplicationService (runs before wolf.toml exists)
├── job/
│   ├── index.ts          # re-exports list helpers
│   └── list.ts           # → ctx.jobApp.list + formatJobList
├── profile.ts        # → ctx.profileApp.list/create/use/delete
├── reach.ts          # → ctx.reachApp.reach (stub-M5)
├── score.ts          # → ctx.scoreApp.score + formatScoreResult
├── status.ts         # → ctx.statusApp.summarize + formatStatus
└── tailor.ts         # → ctx.tailorApp.tailor / analyze / writeResume / writeCoverLetter
```

**Each application-service method:**
- Accepts a typed options object (defined in `src/utils/types/`)
- Returns a typed result object (never prints directly)
- Handles its own error cases and returns structured errors
- Is fully testable in isolation (no CLI/MCP dependencies)

**Example signatures:**

```typescript
// src/application/impl/addApplicationServiceImpl.ts
class AddApplicationServiceImpl {
  async add(options: AddOptions): Promise<AddResult> {
    // Receive already-structured { title, company, jdText, url? },
    // save it to SQLite, and return the jobId.
  }
}

// src/application/impl/huntApplicationServiceImpl.ts
class HuntApplicationServiceImpl {
  async hunt(options: HuntOptions): Promise<HuntResult> {
    // Roadmap surface: provider ingestion plugs in here.
  }
}

// src/application/impl/scoreApplicationServiceImpl.ts
class ScoreApplicationServiceImpl {
  async score(options: ScoreOptions): Promise<ScoreResult> {
  // poll  : drain BatchService.pollAiBatches, walk completed score batches,
  //         parse each item, and write Job.score + Job.scoreJustification
  //         (parse failure → status='error', error='score_error'). Items
  //         are marked consumed so a second --poll is a no-op.
  // single: load profile + 1 candidate; ScoringService.scoreOne runs aiClient
  //         synchronously, parses, persists, and returns singleScore +
  //         singleComment for inline AI-orchestrator presentation.
  // default: load profile + every score:null job (or explicit --jobs);
  //         ScoringService.submitBatch enqueues N requests via
  //         BatchService.submitAiBatch (type='score'); poll later.
  //
  // No code-side dealbreakers — the user's `scoring_notes` (free prose) is
  // fed straight to the prompt and the AI emits the verdict. See
  // DECISIONS.md (2026-05-04) which supersedes the older hybrid design.
  }
}
```

### 4. Types (`src/utils/types/`)

The types module defines shared data structures across all layers — the single source of truth for wolf. Core types include:

- `Company` — a first-class entity, stored separately from jobs. Multiple jobs share one company record. `Job.companyId` is a foreign key to `Company.id`. The `reach` command uses `Company.domain` to infer email patterns.
- `Job` — job listing data, the core object persisted to SQLite.
- `Profile` — per-profile identity and resume source. The active disk source is `profiles/<id>/profile.toml`: identity, contact, work authorization, job preferences, skills, resume entries, projects, education, awards, and builtin application questions live in one governed TOML file. `FileProfileRepositoryImpl` parses it and renders markdown views for AI-facing services that still consume prose. Each profile folder also has `score.md` for profile-level scoring guidance, `prompts/` for editable strategy prompts, and `attachments/` for uploadable files. Validation is content-shape oriented (required TOML fields filled, resume content has enough substantive entries), enforced at command time by `assertReadyForTailor` and surfaced proactively by `wolf doctor`.
- `AppConfig` — workspace-level config, loaded from `wolf.toml`. Contains the default profile name, command model settings, and companion settings (`servePort`, `maxStagehandSessions`, fixed `browserMode`). The fixed companion browser mode means a separate Google Chrome instance with a wolf-owned persistent profile under the workspace; users may install wolf companion and password-manager extensions there once, and the profile is reused by later `wolf serve` runs. Validated at parse time by `AppConfigSchema` (zod). Does **not** embed profile data.
- Per-command Options/Result pairs.

Full definitions in `src/utils/types/`.

### 5. Utils (`src/utils/`)

Shared helper functions used across commands.

```
src/utils/
├── types/            # Shared domain types
├── errors/           # Typed custom error classes
├── config.ts         # Read/write wolf.toml in workspace root (process.cwd())
├── env.ts            # Read WOLF_* system environment variables (no .env file)
├── instance.ts       # build-mode + workspace resolution
├── logger.ts         # Structured logging
├── parseModelRef.ts  # "anthropic/claude-sonnet-4-6" → AiConfig
├── schemas.ts        # Zod schemas for TOML validation
├── stripComments.ts  # remove `> [!IMPORTANT]` / `> [!TIP]` callout blocks
├── extractH2.ts      # `## Heading` body lookup
├── dotPath.ts        # safe dot-path get/set/coerce for wolf.toml edits
└── workspacePaths.ts # canonical paths inside a workspace
```

`src/service/ai/` (provider registry) was historically under `utils/ai/`; it
moved to `service/` as part of the 2026-04-27 layer refactor — wolf treats AI
as a domain capability, not a cross-cutting helper.

### 6. Job Source Provider System

Job data can come from **many different channels**. The `hunt` command uses a **JobProvider** abstraction to support pluggable job sources.

**Why:** Different platforms have wildly different accessibility and each user may have different data sources available.

`JobProvider` interface requires only `name` and `hunt()`. Definition in `src/service/jobProvider.ts`.

**Built-in providers (planned):**

| Provider | Strategy | Notes |
|---|---|---|
| `ApiProvider` | Fetch from any user-configured HTTP endpoint | Generic — works with any JSON API; AI extracts structured fields from raw response |
| `EmailProvider` | Parse job alert emails (Gmail API) | Medium — need email parsing rules |
| `BrowserMCPProvider` | AI-driven browsing via Chrome BrowserMCP | AI navigates job pages and extracts listings |
| `ManualProvider` | User pastes JD or inputs via `wolf hunt --manual` (CLI) | For CLI users; AI agents use `wolf_add` instead |

**How `hunt` uses providers (ingest only):**

```typescript
// src/application/impl/hunt/index.ts
export async function hunt(options: HuntOptions): Promise<HuntResult> {
  const providers = loadEnabledProviders(config);  // from config
  const allJobs: RawJob[] = [];

  for (const provider of providers) {
    const jobs = await provider.hunt(options);
    allJobs.push(...jobs);
  }

  const deduped = deduplicate(allJobs);
  await db.saveJobs(deduped, { status: 'raw', score: null });
  return { ingestedCount: deduped.length, newCount: newJobs.length };
}
```

**How `score` processes ingested jobs (AI-only, no code dealbreakers — see DECISIONS.md 2026-05-04):**

```typescript
// src/application/impl/scoreApplicationServiceImpl.ts
export async function score(options: ScoreOptions): Promise<ScoreResult> {
  // poll: drain pending provider batches and apply unconsumed score items.
  if (options.poll) {
    await batchService.pollAiBatches();
    for (const batch of await batchRepo.listCompletedByType('score')) {
      for (const item of await batchItemRepo.listByBatch(batch.id)) {
        if (item.consumedAt) continue;
        const parsed = parseScoreResponse(item.resultText ?? '');
        if (parsed.ok) await jobRepo.update(item.customId, { score: parsed.value.score, scoreJustification: parsed.value.justification });
        else            await jobRepo.update(item.customId, { status: 'error', error: 'score_error' });
        await batchItemRepo.markConsumed(item.id, new Date().toISOString());
      }
    }
    return { submitted: 0, filtered: 0, polled: completedCount };
  }

  const profileMd = await profileRepo.getProfileMd(profileId);
  const aiConfig = options.aiModel ? parseModelRef(options.aiModel) : defaultAiConfig;
  assertApiKey('ANTHROPIC_API_KEY');

  if (options.single) {
    const target = await pickOneCandidate(options);
    const { score, justification } = await scoring.scoreOne(target, jdText, profileMd, aiConfig);
    await jobRepo.update(target.id, { score, scoreJustification: justification });
    return { submitted: 1, filtered: 0, singleScore: score, singleComment: justification };
  }

  const candidates = await loadUnscoredJobs(options);
  const submission = await scoring.submitBatch(candidates, profileMd, profileId, aiConfig);
  return { submitted: submission.submitted, filtered: 0 };  // filtered always 0 — kept for type stability
}
```

The single AI prompt is composed of the rendered profile markdown view from `profile.toml` (especially the job-preferences scoring notes) + the JD body + an output contract. The model emits `<score>0–10</score><justification>...</justification>`; `parseScoreResponse` divides by 10 for storage in `Job.score`. Filtering is handled downstream — `wolf tailor` decides thresholds.

**Configuration (in `wolf.toml` in workspace root):**

```toml
[providers.linkedin]
enabled = true

[providers.handshake]
enabled = true
strategy = "email"

[providers.manual]
enabled = true
```

This design means:
- Adding a new job source = adding one new file implementing `JobProvider`, no changes to `hunt.ts`
- Users enable/disable providers via config
- Each provider can have its own strategy (email vs manual vs BrowserMCP vs any source)
- Providers are **independent** — if one source fails, others still work

### 7. Batch Infrastructure

AI batch jobs (scoring, and future batch tailoring) are tracked in a shared `batches` table in SQLite. This keeps batch management generic and decoupled from any specific command.

**Interfaces:**
- `BatchRepository` (`src/repository/batch.ts`) — save, getPending, markComplete, markFailed
- `BatchService` (`src/service/batch.ts`) — submit, pollAll

**`batches` table schema (`src/repository/impl/schema.ts`):**

| Field | Type | Notes |
|---|---|---|
| `batchId` | text | Provider-assigned batch ID |
| `type` | text | `"score"`, `"tailor"`, etc. |
| `aiProvider` | text | `"anthropic"` or `"openai"` |
| `submittedAt` | text | ISO 8601 timestamp |
| `status` | text | `"pending"`, `"completed"`, `"failed"` |

**Poll triggers:**
- `wolf score --poll` — explicit poll without submitting a new batch

`BatchService.pollAll()` fetches completed batches and calls registered result handlers. Commands never touch `batchId` directly — batch lifecycle is fully managed through `BatchService` and `BatchRepository`.

### 8. External Service Integrations

Each external service is accessed only from `src/service/`, `src/application/`, or job providers. No direct service calls from CLI/MCP layers.

| Service | SDK / Method | Used By |
|---|---|---|
| **Apify** | `apify-client` | Optional — used by providers that choose this strategy |
| **Claude API** | `@anthropic-ai/sdk` | `hunt` (JD scoring), `tailor` (resume rewriting), `reach` (email drafting) |
| **Playwright** | `playwright` | `fill` (form detection, filling, submission, screenshots) |
| **BrowserMCP** | Chrome DevTools Protocol | `BrowserMCPProvider` (AI-driven job page navigation) |
| **SQLite** | `better-sqlite3` | `db.ts` (job storage, status tracking) |
| **Gmail API** | `googleapis` | `reach` (send email), `EmailProvider` (parse job alert emails) |

## Data Flow Examples

### `wolf hunt --role "Software Engineer" --location "NYC"`

```
CLI parses args
  → hunt({ role: "Software Engineer", location: "NYC" })
    → config.load()                           # read wolf.toml from workspace root
    → providers.forEach(p => p.hunt(options)) # run all enabled providers
    → deduplicate(allJobs)                    # merge and dedupe
    → db.saveJobs(jobs, { status: 'raw', score: null })  # persist raw to SQLite
    → return { ingestedCount, newCount }
  ← CLI prints ingestion summary
```

### `wolf_add` (AI-orchestrated flow)

```
User shares job with AI (screenshot / pasted text / URL)
  → AI (Claude/OpenClaw) extracts { title, company, jdText, url? }
  → wolf_add({ title, company, jdText })
    → add({ title, company, jdText })
      → db.saveJob({ ...structured, status: 'raw', score: null })
      → return { jobId }
  → wolf_score({ jobIds: [jobId], single: true })   # OR POST /api/score with { jobIds, single: true }
    → score({ jobIds: [jobId], single: true })
      → scoring.scoreOne(job, jdText, profileMd, aiConfig)  # one synchronous Haiku call
      → parse <score>0–10</score><justification>...</justification>
      → jobRepo.update(jobId, { score, scoreJustification })
      → return { submitted: 1, filtered: 0, singleScore, singleComment }
  ← AI presents score + justification to user, offers to tailor
```

### `wolf score` (bulk batch flow)

```
CLI parses args
  → score({ profileId })
    → jobRepo.query({ limit: 10_000 }).filter(j => j.score === null)   # unscored only
    → scoring.submitBatch(jobs, profileMd, profileId, aiConfig)        # one prompt per job, all enqueued
    → BatchService.submitAiBatch(...)         # writes batches + batch_items rows; returns wolf-internal batchId
    → return { submitted, filtered }
  ← CLI prints batch summary; scoring completes in background
```

### `wolf tailor full --job <job_id> [--hint "..."]`

```
CLI parses args
  → tailor({ jobId, hint })
    → prepareContext: loadJob + loadProfile + loadResumePool + jobRepo.readJdText(jobId) + jobRepo.getWorkspaceDir(jobId)
    → ensureHintFile: write data/jobs/<dir>/src/hint.md (header only if absent; overwrite if --hint given)
    → analyst = TailoringBriefService.analyze(pool, jd, profile, ai, hint)
        → Claude → Markdown brief
        → writeFile data/jobs/<dir>/src/tailoring-brief.md
    → Promise.all:
        → ResumeCoverLetterService.tailorResumeToHtml(pool, jd, profile, brief, ai)
          → Claude → HTML body
          → RenderService.renderPdf(html)  # Playwright + fit() binary search
          → writeFile data/jobs/<dir>/{src/resume.html, resume.pdf}
        → ResumeCoverLetterService.generateCoverLetter(pool, jd, profile, brief, ai)
          → Claude → HTML body
          → RenderService.renderCoverLetterPdf(html)  # Playwright, natural layout (no fit loop)
          → writeFile data/<jobId>/{src/cover_letter.html, cover_letter.pdf}
    → db.updateJob(jobId, { hasTailoredResume: true, hasTailoredCoverLetter: true })
    → return { tailoredPdfPath, coverLetterHtmlPath, coverLetterPdfPath, ... }
  ← CLI prints JSON summary
```

Writer-only steps: `wolf tailor brief|resume|cover --job <id>` run just that
phase. Brief is read from disk on resume/cover; missing brief produces a clear
error directing the user to run `wolf tailor brief` first.

β.10h: artifact paths are convention-derived under `data/jobs/<dir>/` via
`JobRepository.getArtifactPath(id, kind)`. The Job row stores 4 booleans
(`hasTailoredResume` / `hasTailoredCoverLetter` / `hasScreenshots` /
`hasOutreachDraft`) — `hasX = true` means "wolf produced this artifact",
not "file currently exists on disk"; consumers handle ENOENT.

β.7+: JD text lives in the SQLite `jobs.description_md` column (no longer
on disk as `jd.md`). The tailor app service reads it through
`JobRepository.readJdText(jobId)`.

### `wolf fill --job <job_id> --dry-run`

```
CLI parses args
  → fill({ jobId: "abc123", dryRun: true })
    → db.getJob(jobId)                       # fetch job URL
    → playwright.launch()                    # start browser
    → detectFormFields(page)                 # scan form inputs
    → mapFieldsToProfile(fields, config)     # match fields to user data
    → if (!dryRun) fillAndSubmit(page, map)  # fill form (skipped in dry-run)
    → screenshot(page)                       # capture for audit
    → return { fields, mapping, screenshotPath }
  ← CLI prints detected fields table
```

### Companion `Autofill this page`

```
Side panel POST /api/fill/quick
  → CompanionActionApplicationService.quickFill({ jobId, tabId, userPrompt })
    → ServeBrowserManager.getPage(tabId)          # wolf-controlled browser only
    → StagehandFillService.fill(...)              # TODO: LOCAL observe/cache/replay
    → if Stagehand not wired, safe Playwright fallback fills obvious profile/contact fields
    → never clicks submit
    → return run status through GET /api/runs/:runId
```

The Stagehand dependency is present, but the first companion MVP keeps real
Stagehand execution behind `StagehandFillService`. Until that service is wired
to a CDP session pool and selector cache, autofill remains a conservative
Playwright fallback and preserves the no-auto-submit rule.

## File System Layout

### Project directory (`wolf/`)

Source code, config, docs. Checked into git.

### Workspace directory (user-chosen, any folder)

Created by `wolf init` in the current working directory (`process.cwd()`). The user chooses where this lives — `~/Documents/my-job-search/` or anywhere they prefer.

wolf looks for `wolf.toml` in `process.cwd()` on every command. If not found, it exits with "run wolf init first."

This design aligns with how AI agents work: Claude Code's working context is the open folder, so wolf's workspace is always in scope without cross-directory jumps or permission issues.

```
<workspace>/
├── wolf.toml           # Workspace-level config: defaultProfileId, providers, hunt, reach
├── profiles/           # Per-profile content — committable (not gitignored)
│   └── <profileId>/    # e.g. profiles/default/
│       ├── profile.toml          # Identity, resume pool, work auth, Q&A, scoring facts
│       ├── score.md              # Optional profile-level scoring guidance
│       ├── prompts/              # Editable strategy prompt pack
│       └── attachments/          # Uploadable files (transcripts, portfolio, etc.)
├── .gitignore          # Auto-generated by wolf init
├── credentials/        # OAuth tokens (Gmail) — gitignored
└── data/               # Generated artifacts — gitignored
    ├── wolf.sqlite      # Structured metadata, raw inbox, background AI batches
    ├── wolf-browser-profile/ # Persistent profile for the wolf-controlled browser
    ├── jobs/
    │   └── <company>_<title>_<jobIdShort>/
    │       ├── src/
    │       │   ├── hint.md
    │       │   ├── tailoring-brief.md
    │       │   ├── resume.html
    │       │   └── cover_letter.html
    │       ├── resume.pdf          # Final PDF
    │       └── cover_letter.pdf    # Final PDF
    └── companies/
        └── <company>_<companyIdShort>/
            └── info.md             # Free-form employer notes
```

Raw inbox data lives in SQLite `inbox_items`, not per-capture folders. The
table stores only original manual-page or hunt-result payloads plus processing
state (`raw`, `queued`, `promoted`, `failed`, etc.). Explicit user actions can
create `background_ai_batches` / shards / items for paid processing. The current
companion MVP can also promote manual raw pages directly into canonical `jobs`
rows with a conservative local extraction path; future AI promotion can replace
that path without changing the inbox contract. Successful AI output is applied
immediately to canonical job state; only short-lived debug payloads remain in
`background_ai_batch_items`.

> API keys (`WOLF_ANTHROPIC_API_KEY`, etc.) are stored as shell environment variables — never in the workspace. Use `wolf env show` / `wolf env clear` to manage.

**`profiles/` vs `data/`:**
- `profiles/` contains user-authored content (profile config, resume pool). Safe to commit to a private git repo for multi-machine sync.
- `data/` contains generated artifacts (SQLite binary, compiled PDFs, screenshots). Gitignored.

> API keys (`WOLF_ANTHROPIC_API_KEY`, etc.) are stored as shell environment variables — never in the workspace. Use `wolf env set` to configure them in `~/.zshrc`.

## Inter-Component Communication

Commands do not call each other directly. **SQLite is the shared communication bus.**

Each command reads input from the database, does its work, and writes results back:

```
hunt()   ── writes → [SQLite: jobs row incl. description_md] ── reads → tailor()
tailor() ── writes → [SQLite: has_tailored_resume=true + data/jobs/<dir>/resume.pdf] ── reads → fill()
fill()   ── writes → [SQLite: status="applied" + has_screenshots=true] ── reads → reach()
reach()  ── writes → [SQLite: has_outreach_draft=true]
```

Concrete example:

```typescript
// add/hunt: every metadata column on Job, JD prose written via repo
await jobRepo.save({ id: "abc", title: "SDE", companyId: "company-uuid", status: "new", score: 0.9, /* ...other fields */ })
await jobRepo.writeJdText("abc", jdText)   // β.7+: persists to jobs.description_md SQLite column

// tailor: read JD, flip the produced-this-artifact booleans on the Job row.
// β.10h: paths are convention-derived from getWorkspaceDir + a fixed name.
const jdText  = await jobRepo.readJdText("abc")
const pdfPath = await jobRepo.getArtifactPath("abc", "resume_pdf")  // <workspaceDir>/resume.pdf
await jobRepo.update("abc", { hasTailoredResume: true, hasTailoredCoverLetter: true })

// fill: read job, mark screenshots produced + bump status.
const job = await jobRepo.get("abc")  // job.hasTailoredResume tells us tailor already ran
await jobRepo.update("abc", { status: "applied", hasScreenshots: true })

// reach: write outreach draft, mark the boolean.
await jobRepo.update("abc", { hasOutreachDraft: true })
```

This design means:
- Commands are **fully independent** — each can run alone without importing others
- Order is flexible — user (or an orchestrator) decides the sequence
- State is **inspectable** — `wolf status` just reads the same SQLite
- Crash recovery is free — partial progress is already persisted

## External Orchestration Integration

wolf is designed to be **orchestrated, not to orchestrate**. The MCP layer already exposes all commands as callable tools. This means external workflow engines can drive wolf without any code changes.

### n8n integration

n8n can call wolf in two ways:

```
┌────────────────────────────────────────────────────┐
│  n8n workflow                                      │
│                                                    │
│  [Trigger] → [Execute: wolf hunt --json]           │
│                     ↓                              │
│           [IF score > 0.8]                         │
│              ↓           ↓                         │
│  [Execute: wolf tailor]  [Skip]                    │
│              ↓                                     │
│  [Execute: wolf fill --dry-run]                    │
│              ↓                                     │
│  [Human approval node]                             │
│              ↓                                     │
│  [Execute: wolf reach --send]                      │
└────────────────────────────────────────────────────┘
```

- **Option A: CLI shell execution** — n8n's "Execute Command" node runs `wolf hunt --json`, `wolf tailor --json`, etc. The `--json` flag makes wolf output machine-readable JSON instead of terminal tables.
- **Option B: MCP client** — n8n connects to `wolf mcp serve` as an MCP client and calls `wolf_hunt`, `wolf_tailor` directly with structured input/output.

### LangGraph / AI agent integration

Any LangGraph agent (or similar framework) can use wolf as a tool provider via MCP:

```
┌──────────────────────────────────────────────┐
│  LangGraph agent                             │
│                                              │
│  [State: job_search] → call wolf_hunt        │
│         ↓                                    │
│  [State: evaluate]   → read results, decide  │
│         ↓                                    │
│  [State: tailor]     → call wolf_tailor      │
│         ↓                                    │
│  [State: apply]      → call wolf_fill        │
│         ↓                                    │
│  [State: outreach]   → call wolf_reach       │
└──────────────────────────────────────────────┘
```

The agent connects to wolf's MCP server and treats each wolf tool as a node in its graph. Wolf handles the job-specific logic; the agent handles orchestration, branching, and human-in-the-loop decisions.

### Design implications

To keep wolf friendly to external orchestrators:
1. **All commands support `--json` output** — machine-readable, no ANSI colors
2. **All commands are idempotent where possible** — running `tailor` twice on the same job overwrites the previous result safely
3. **MCP tools have strict input/output schemas** — external tools can validate before calling
4. **No command depends on another command's in-memory state** — SQLite is the only shared state, readable by any process

## Build & Run

```
TypeScript (src/)  →  tsc  →  JavaScript (dist/)  →  node dist/cli/index.js
                                                   →  node dist/mcp/server.js
```

- `npm run build` — compile TypeScript to `dist/`
- `npm run dev` — watch mode with `tsx` or `ts-node`
- `wolf --help` — CLI (via `package.json` `bin`)
- `wolf mcp serve` — start MCP server

## Security Considerations

- **API keys** stored as `WOLF_*` shell environment variables, never in the workspace directory — workspace may be shared, cloud-synced, or zipped alongside resume files. Use `wolf env show` / `wolf env clear` to manage.
- **Gmail OAuth tokens** stored in `~/.wolf/credentials/`, never committed
- **Form filling** defaults to dry-run; explicit `--no-dry-run` or confirmation required for live submission
- **Email sending** requires `--send` flag plus interactive confirmation
- **No data leaves the machine** except through explicit API calls (Claude, Gmail, and any provider APIs you configure)

## Testing Strategy

### Test-Driven Development (TDD)

**All new features and commands MUST follow test-driven development:**

1. **Write failing tests first** — define expected behavior before writing implementation
2. **Implement until tests pass** — write the minimum code to satisfy the tests
3. **Refactor with confidence** — tests protect against regressions

This is especially critical for AI-integrated features (scoring, resume rewriting, email drafting). Tests with mocked AI responses act as **hallucination guardrails** — they define the expected output structure and constraints, catching cases where the AI returns malformed, off-topic, or fabricated data.

**Example — testing `hunt` scoring:**

```typescript
// Write this FIRST:
it('should reject AI scores outside 0.0-1.0 range', async () => {
  mockClaude.returns({ score: 1.5 }); // hallucinated score
  await expect(hunt(options)).rejects.toThrow('Score out of range');
});

it('should require score justification field', async () => {
  mockClaude.returns({ score: 0.8 }); // missing justification
  await expect(hunt(options)).rejects.toThrow('Missing justification');
});

// THEN implement the validation in hunt.ts
```

### Test Levels

- **Unit tests** for `src/application/` — mock external services, test business logic
- **Integration tests** for CLI and MCP layers — verify argument parsing and output formatting
- **E2E tests** for `wolf fill` — Playwright tests against sample forms
- Test runner: vitest (lightweight, TypeScript-native)

### AI Hallucination Prevention

Commands that use Claude API MUST validate AI responses:

| Command | Validation |
|---|---|
| `hunt` (scoring) | Score is a number in [0.0, 1.0], justification is non-empty string |
| `tailor` (rewriting) | Output preserves resume structure, no fabricated experience or skills |
| `reach` (email draft) | Email contains correct company/role names from input, no invented facts |

All validations are enforced by tests written **before** the implementation.

### CI/CD

GitHub Actions CI is active from Milestone 1. Every push and PR triggers the pipeline.

**Current pipeline:**

```
push / PR → build (tsc) → test (vitest)
```

**Planned additions:**
1. **Milestone 2+:** Add lint (ESLint) and type-check (`tsc --noEmit`) steps.
2. **Milestone 3+:** Add E2E tests to CI. Gate PRs on all checks passing.
3. **Milestone 5+:** Add release automation (changelog generation, npm publish).

**Rule:** No code merges to `main` without passing tests. CI is the enforcer, not human discipline.
