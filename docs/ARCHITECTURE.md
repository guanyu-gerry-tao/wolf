# Architecture — wolf

## Overview

wolf is a dual-interface application: it runs as both a **CLI tool** (for human users) and an **MCP server** (for AI agents like OpenClaw). Both interfaces share the same core command logic, ensuring consistent behavior regardless of how wolf is invoked.

```
                ┌─────────────────────────────────────────────┐
                │                 Consumers                   │
                │                                             │
                │   Human (terminal)      AI Agent (OpenClaw) │
                └──────┬──────────────────────────┬───────────┘
                       │                          │
                       v                          v
                ┌─────────────┐          ┌────────────────┐
                │  CLI Layer  │          │   MCP Layer    │
                │ commander.js│          │   MCP SDK      │
                └──────┬──────┘          └───────┬────────┘
                       │                         │
                       └────────┬────────────────┘
                                │
                                v
                ┌──────────────────────────────┐
                │       Commands (Core)        │
                │  hunt / tailor / fill / reach │
                │           status             │
                └──────┬───────────────┬───────┘
                       │               │
              ┌────────┴───┐     ┌─────┴──────────┐
              v            v     v                 v
        ┌──────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐
        │ External │ │ AI     │ │ Browser  │ │ Local   │
        │ Services │ │ Layer  │ │ Layer    │ │ Storage │
        │ External │ │ Claude │ │Playwright│ │ SQLite  │
        │ Gmail    │ │  API   │ │          │ │         │
        └──────────┘ └────────┘ └──────────┘ └─────────┘
```

## Design Principles

1. **Interface-agnostic core** — Command logic lives in `src/commands/`, never in `src/cli/` or `src/mcp/`. CLI and MCP are thin wrappers that parse input, call the command, and format output.
2. **Shared types as contracts** — `src/types/` defines the data shapes (Job, Resume, AppConfig) that every layer depends on. This is the single source of truth.
3. **Fail-safe by default** — Destructive operations (form submission, email sending) require explicit flags (`--send`, without `--dry-run`). Default behavior is always preview/dry-run.
4. **Local-first data** — All job data, configs, and tailored resumes are stored locally. No cloud dependency for core state.

## Layer Details

### 1. CLI Layer (`src/cli/`)

Entry point for human users. Built with **commander.js**.

```
src/cli/
├── index.ts          # CLI entry point, registers all commands
└── formatters.ts     # Terminal output formatting (tables, colors, etc.)
```

**Responsibilities:**
- Parse command-line arguments and flags
- Call the corresponding function in `src/commands/`
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
- Map incoming tool calls to the corresponding function in `src/commands/`
- Return structured JSON results (no terminal formatting)

The MCP layer registers 6 tools (`wolf_hunt`, `wolf_add`, `wolf_score`, `wolf_tailor`, `wolf_fill`, `wolf_reach`, `wolf_status`). `wolf_add` is MCP-only — it has no CLI equivalent, because its caller (an AI agent) already holds the structured content and wolf only needs to store it. Input/output schemas are defined in [TYPES.md § MCP Tool Schemas](TYPES.md#mcp-tool-schemas).

### 3. Commands Layer (`src/commands/`)

The core of wolf. Each file exports a single async function containing all business logic for one command.

```
src/commands/
├── hunt/             # Job ingestion — fetch raw jobs from providers, save to DB
├── add/              # Single job ingestion — store AI-structured job from MCP caller
├── score/            # Job processing — AI extraction, dealbreaker filtering, scoring
├── tailor/           # Resume tailoring
├── fill/             # Form auto-fill
├── reach/            # HR contact finding and outreach
├── status/           # Job tracking dashboard
├── env/              # API key management (set/show/clear)
└── init/             # Setup wizard
```

**Each command function:**
- Accepts a typed options object (defined in `src/types/`)
- Returns a typed result object (never prints directly)
- Handles its own error cases and returns structured errors
- Is fully testable in isolation (no CLI/MCP dependencies)

**Example signatures:**

```typescript
// src/commands/add/index.ts — single job from AI orchestrator (MCP only)
export async function add(options: AddOptions): Promise<AddResult> {
  // 1. Receive already-structured { title, company, jdText, url? } from AI caller
  // 2. Save to DB with status: raw, score: null
  // 3. Return jobId for chaining into wolf_score or wolf_tailor
}

// src/commands/hunt/index.ts — fetch only
export async function hunt(options: HuntOptions): Promise<HuntResult> {
  // 1. Load enabled providers from config
  // 2. Run each provider, collect raw jobs
  // 3. Deduplicate across providers
  // 4. Save to DB with status: raw, score: null
  // 5. Return ingested count
}

// src/commands/score/index.ts — process only
export async function score(options: ScoreOptions): Promise<ScoreResult> {
  // 1. Read unscored jobs (score: null) from DB
  // 2. AI field extraction (sponsorship, tech stack, remote, salary)
  // 3. Apply dealbreakers — save disqualified as status: filtered
  // 4. Submit remaining jobs to Claude Batch API for async scoring
  // 5. Return batch ID and pending count
}
```

### 4. Types (`src/types/`)

The types layer defines shared data structures across all layers — the single source of truth for wolf. Core types include:

- `Company` — a first-class entity, stored separately from jobs. Multiple jobs share one company record. `Job.companyId` is a foreign key to `Company.id`. The `reach` command uses `Company.domain` to infer email patterns.
- `Job` — job listing data, the core object persisted to SQLite.
- `Resume` — parsed resume structure.
- `UserProfile` — full identity used during applications. wolf supports **multiple profiles** (e.g. different immigration statuses, name variants for ATS workarounds). `AppConfig.profiles` is an array; `defaultProfileId` sets the default; `Job.appliedProfileId` records which profile was used.
- `AppConfig` — user configuration, loaded from `wolf.toml` in the workspace root.
- Per-command Options/Result pairs.

Full definitions in [TYPES.md](TYPES.md).

### 5. Utils (`src/utils/`)

Shared helper functions used across commands.

```
src/utils/
├── config.ts         # Read/write wolf.toml in workspace root (process.cwd())
├── db.ts             # SQLite database access (CRUD for jobs)
├── env.ts            # Read WOLF_* system environment variables (no .env file)
└── logger.ts         # Structured logging
```

### 6. Job Source Provider System

Job data can come from **many different channels**. The `hunt` command uses a **JobProvider** abstraction to support pluggable job sources.

**Why:** Different platforms have wildly different accessibility and each user may have different data sources available.

`JobProvider` interface requires only `name` and `hunt()`. Definition in [TYPES.md § Provider Interface](TYPES.md#provider-interface).

**Built-in providers (planned):**

| Provider | Strategy | Notes |
|---|---|---|
| `ApiProvider` | Fetch from any user-configured HTTP endpoint | Generic — works with any JSON API; AI extracts structured fields from raw response |
| `EmailProvider` | Parse job alert emails (Gmail API) | Medium — need email parsing rules |
| `BrowserMCPProvider` | AI-driven browsing via Chrome BrowserMCP | AI navigates job pages and extracts listings |
| `ManualProvider` | User pastes JD or inputs via `wolf hunt --manual` (CLI) | For CLI users; AI agents use `wolf_add` instead |

**How `hunt` uses providers (ingest only):**

```typescript
// src/commands/hunt/index.ts
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

**How `score` processes ingested jobs:**

```typescript
// src/commands/score/index.ts
export async function score(options: ScoreOptions): Promise<ScoreResult> {
  const jobs = await db.getJobs({ score: null });           // unscored only
  const extracted = await ai.extractFields(jobs);           // AI: sponsorship, techStack, remote, salary
  const { pass, filtered } = applyDealbreakers(extracted, profile);
  await db.updateJobs(filtered, { status: 'filtered' });
  await batch.submit(pass, { type: 'score', profile });     // stores batchId in batches table
  return { submitted: pass.length, filtered: filtered.length };
}
```

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

### 7. Batch Infrastructure (`src/utils/batch.ts`)

AI batch jobs (scoring, and future batch tailoring) are tracked in a shared `batches` table in SQLite. This keeps batch management generic and decoupled from any specific command.

**`batches` table (planned schema):**

| Field | Type | Notes |
|---|---|---|
| `batchId` | string | Provider-assigned batch ID |
| `type` | string | `"score"`, `"tailor"`, etc. |
| `aiProvider` | string | `"anthropic"` or `"openai"` |
| `submittedAt` | string | ISO 8601 timestamp |
| `status` | string | `"pending"`, `"completed"`, `"failed"` |

**Poll triggers:**
- `wolf status` — polls all pending batches before displaying results
- `wolf score --poll` — explicit poll without submitting a new batch

Each `type` registers a handler in `batch.ts`. When a batch completes, the handler writes results back to the `jobs` table. Commands never touch `batchId` directly — batch lifecycle is fully managed by `utils/batch.ts`.

### 8. External Service Integrations

Each external service is accessed only from `src/commands/`, `src/utils/`, or job providers. No direct service calls from CLI/MCP layers.

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
  → wolf_score({ jobIds: [jobId], single: true })
    → score({ jobIds: [jobId], single: true })
      → ai.extractFields([job])               # Claude: structured field extraction
      → applyDealbreakers(job, profile)       # hard filter check
      → claude.haiku.score(job, profile)      # synchronous Haiku call, returns immediately
      → return { submitted: 1, filtered: 0 }
  ← AI presents score + analysis to user, offers to tailor
```

### `wolf score` (bulk batch flow)

```
CLI parses args
  → score({ profileId })
    → db.getJobs({ score: null })             # fetch all unscored jobs
    → ai.extractFields(jobs)                  # Claude: extract sponsorship, techStack, remote, salary from JD text
    → applyDealbreakers(jobs, profile)        # hard filter — disqualified → status: filtered
    → ai.submitBatch(remaining, profile)      # submit to Claude Batch API (async, returns immediately)
    → return { submitted, filtered }
  ← CLI prints batch summary; scoring completes in background
```

### `wolf tailor --job <job_id>`

```
CLI parses args
  → tailor({ jobId: "abc123" })
    → db.getJob(jobId)                       # fetch JD from local DB
    → loadConfig() → profile.resumePath      # get resume path from profile
    → snapshotResume(resumePath)             # hash file → copy to data/resume/snapshots/master_<hash>.<ext>
    → read tailor_notes.md (if present)      # per-job prompt layer (see issue #37)
    → if .tex: send raw .tex + JD to Claude  # Claude rewrites bullet points, preserves template
      if .pdf: pdftoppm → PNG → Claude Vision # Claude sees layout, generates complete new .tex
    → validate returned .tex
    → parse %WOLF_META for matchScore + changes
    → writeFile(data/tailored/<jobId>.tex)   # save tailored .tex
    → pdflatex(tailoredTexPath)             # compile to PDF (two passes)
    → pdftoppm(tailoredPdfPath)             # first-page screenshot for visual review
    → db.updateJob(jobId, { tailoredResumePath, tailoredResumePdfPath, screenshotPath, masterResumeSnapshot })
    → return { tailoredTexPath, tailoredPdfPath, changes, matchScore }
  ← CLI prints diff and summary
```

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

## File System Layout

### Project directory (`wolf/`)

Source code, config, docs. Checked into git.

### Workspace directory (user-chosen, any folder)

Created by `wolf init` in the current working directory (`process.cwd()`). The user chooses where this lives — `~/Documents/my-job-search/` or anywhere they prefer.

wolf looks for `wolf.toml` in `process.cwd()` on every command. If not found, it exits with "run wolf init first."

This design aligns with how AI agents work: Claude Code's working context is the open folder, so wolf's workspace is always in scope without cross-directory jumps or permission issues.

```
<workspace>/
├── wolf.toml         # User config: profiles, providers, scoring prefs (TOML, human-editable)
├── .gitignore        # Auto-generated by wolf init
├── resume/           # User's resume files (user-managed)
├── credentials/      # OAuth tokens (Gmail) — gitignored
└── data/             # Generated files — gitignored
    ├── wolf.sqlite   # Job listings, statuses, scores
    ├── tailored/     # Generated tailored resumes (.tex + .pdf)
    ├── screenshots/  # Form fill audit screenshots
    └── outreach/     # Draft outreach emails
```

> API keys (`WOLF_ANTHROPIC_API_KEY`, etc.) are stored as shell environment variables — never in the workspace. Use `wolf env set` to configure them in `~/.zshrc`.

## Inter-Component Communication

Commands do not call each other directly. **SQLite is the shared communication bus.**

Each command reads input from the database, does its work, and writes results back:

```
hunt()   ── writes → [SQLite: jobs table] ── reads → tailor()
tailor() ── writes → [SQLite: tailored_resume_path] ── reads → fill()
fill()   ── writes → [SQLite: status="applied"] ── reads → reach()
reach()  ── writes → [SQLite: outreach_draft_path]
```

Concrete example:

```typescript
// hunt: save discovered jobs (companyId references the Company table)
db.saveJob({ id: "abc", title: "SDE", companyId: "company-uuid", status: "new", score: 0.9 })

// tailor: read job, write tailored .tex + .pdf paths back
const job = db.getJob("abc")
db.updateJob("abc", { tailoredResumePath: "./data/tailored/abc.tex", tailoredResumePdfPath: "./data/tailored/abc.pdf" })

// fill: read job + resume path, update status
const job = db.getJob("abc")  // has job.url + job.tailoredResumePath
db.updateJob("abc", { status: "applied", screenshotPath: "./data/screenshots/abc.png" })

// reach: read job, write outreach draft path
const job = db.getJob("abc")  // has job.companyId, job.title
db.updateJob("abc", { outreachDraftPath: "./data/outreach/abc.md" })
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

- **Unit tests** for `src/commands/` — mock external services, test business logic
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
