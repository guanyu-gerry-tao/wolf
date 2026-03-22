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

The MCP layer registers 5 tools (`wolf_hunt`, `wolf_tailor`, `wolf_fill`, `wolf_reach`, `wolf_status`), each mapping directly to the corresponding function in `src/commands/`. Input/output schemas are defined in [TYPES.md § MCP Tool Schemas](TYPES.md#mcp-tool-schemas).

### 3. Commands Layer (`src/commands/`)

The core of wolf. Each file exports a single async function containing all business logic for one command.

```
src/commands/
├── hunt/             # Job search and scoring
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

**Example signature:**

```typescript
// src/commands/hunt.ts
export async function hunt(options: HuntOptions): Promise<HuntResult> {
  // 1. Read config
  // 2. Run enabled job providers
  // 3. Deduplicate results
  // 4. Score with Claude API
  // 5. Save to local DB
  // 6. Return structured result
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

| Provider | Strategy | Difficulty |
|---|---|---|
| `EmailProvider` | Parse job alert emails (Gmail API) | Medium — need email parsing rules |
| `BrowserMCPProvider` | AI-driven browsing via Chrome BrowserMCP | Medium — AI navigates and extracts |
| `ManualProvider` | User pastes JD or inputs via `wolf hunt --manual` | Low — just a form/prompt |

**How `hunt` uses providers:**

```typescript
// src/commands/hunt.ts
export async function hunt(options: HuntOptions): Promise<HuntResult> {
  const providers = loadEnabledProviders(config);  // from config
  const allJobs: Job[] = [];

  for (const provider of providers) {
    const jobs = await provider.hunt(options);
    allJobs.push(...jobs);
  }

  const deduped = deduplicate(allJobs);
  const filtered = applyDealbreakers(deduped, profile); // hard filters before scoring — saves AI calls
  const scored = await scoreJobs(filtered, profile);    // hybrid: algorithm scores most factors, Claude API scores roleMatch only
  await db.saveJobs(scored);
  return { jobs: scored, newCount: scored.length, avgScore: avg(scored) };
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

### 7. External Service Integrations

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
    → config.load()                          # read wolf.toml from workspace root
    → providers.forEach(p => p.hunt(options)) # run all enabled providers
    → deduplicate(allJobs)                   # merge and dedupe
    → applyDealbreakers(jobs, profile)        # hard filter before scoring (saves AI calls)
    → scoreJobs(jobs, profile)               # hybrid: algorithm (workAuth/location/salary/…) + Claude API (roleMatch only)
    → db.saveJobs(scoredJobs)                # persist to SQLite
    → return { jobs: scoredJobs, newCount, avgScore }
  ← CLI formats as table and prints
```

### `wolf tailor --job <job_id>`

```
CLI parses args
  → tailor({ jobId: "abc123" })
    → db.getJob(jobId)                       # fetch JD from local DB
    → profile.resumePath                     # get base .tex resume path from profile
    → parseResume(resumePath)                # parse .tex into structured Resume
    → claude.tailorResume(resume, job.desc)  # AI rewrite
    → writeFile(tailoredTexPath, result)     # save tailored .tex
    → xelatex(tailoredTexPath)              # compile to PDF
    → return { tailoredTexPath, tailoredPdfPath, coverLetterMdPath, coverLetterPdfPath, changes, matchScore }
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
