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
                │  hunt / tailor / file / reach │
                │           status             │
                └──────┬───────────────┬───────┘
                       │               │
              ┌────────┴───┐     ┌─────┴──────────┐
              v            v     v                 v
        ┌──────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐
        │ External │ │ AI     │ │ Browser  │ │ Local   │
        │ Services │ │ Layer  │ │ Layer    │ │ Storage │
        │ Apify,   │ │ Claude │ │Playwright│ │ SQLite  │
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

**Registered tools:**

| MCP Tool | Maps to Command | Description |
|---|---|---|
| `wolf_hunt` | `hunt()` | Find and score jobs |
| `wolf_tailor` | `tailor()` | Tailor resume to a JD |
| `wolf_file` | `file()` | Auto-fill application form |
| `wolf_reach` | `reach()` | Find contacts and draft outreach |

### 3. Commands Layer (`src/commands/`)

The core of wolf. Each file exports a single async function containing all business logic for one command.

```
src/commands/
├── hunt.ts           # Job search and scoring
├── tailor.ts         # Resume tailoring
├── file.ts           # Form auto-fill
├── reach.ts          # HR contact finding and outreach
├── status.ts         # Job tracking dashboard
└── init.ts           # Setup wizard
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
  // 2. Call Apify scrapers
  // 3. Deduplicate results
  // 4. Score with Claude API
  // 5. Save to local DB
  // 6. Return structured result
}
```

### 4. Types (`src/types/`)

Shared TypeScript types used across all layers.

```
src/types/
└── index.ts          # All type exports
```

**Core types:**

| Type | Purpose |
|---|---|
| `Job` | A job listing: id, title, company, url, source, description, score, status |
| `Resume` | Parsed resume: sections, bullet points, skills, metadata |
| `AppConfig` | User configuration: resume path, target roles, locations, API keys |
| `HuntOptions` / `HuntResult` | Input/output for `hunt` command |
| `TailorOptions` / `TailorResult` | Input/output for `tailor` command |
| `FileOptions` / `FileResult` | Input/output for `file` command |
| `ReachOptions` / `ReachResult` | Input/output for `reach` command |

**Job status lifecycle:**

```
new  →  reviewed  →  applied
                  →  rejected
```

### 5. Utils (`src/utils/`)

Shared helper functions used across commands.

```
src/utils/
├── config.ts         # Read/write ~/.wolf/config.json
├── db.ts             # SQLite database access (CRUD for jobs)
├── env.ts            # Load and validate .env variables
└── logger.ts         # Structured logging
```

### 6. External Service Integrations

Each external service is accessed only from `src/commands/` or `src/utils/`. No direct service calls from CLI/MCP layers.

| Service | SDK / Method | Used By |
|---|---|---|
| **Apify** | `apify-client` | `hunt` (LinkedIn scraper, Handshake scraper), `reach` (people search) |
| **Claude API** | `@anthropic-ai/sdk` | `hunt` (JD scoring), `tailor` (resume rewriting), `reach` (email drafting) |
| **Playwright** | `playwright` | `file` (form detection, filling, submission, screenshots) |
| **SQLite** | `better-sqlite3` | `db.ts` (job storage, status tracking) |
| **Gmail API** | `googleapis` | `reach` (send email via OAuth2) |

## Data Flow Examples

### `wolf hunt --role "Software Engineer" --location "NYC"`

```
CLI parses args
  → hunt({ role: "Software Engineer", location: "NYC" })
    → config.load()                          # read ~/.wolf/config.json
    → apify.runLinkedInScraper(role, loc)     # scrape LinkedIn
    → apify.runHandshakeScraper(role, loc)    # scrape Handshake
    → deduplicate(linkedinJobs, hsJobs)       # merge and dedupe
    → claude.scoreJobs(jobs, userProfile)     # AI relevance scoring
    → db.saveJobs(scoredJobs)                # persist to SQLite
    → return { jobs: scoredJobs, newCount, avgScore }
  ← CLI formats as table and prints
```

### `wolf tailor --job <job_id>`

```
CLI parses args
  → tailor({ jobId: "abc123" })
    → db.getJob(jobId)                       # fetch JD from local DB
    → config.getResumePath()                 # get resume .md path
    → parseResume(resumePath)                # parse into structured Resume
    → claude.tailorResume(resume, job.desc)  # AI rewrite
    → writeFile(tailoredPath, result)        # save tailored .md
    → return { tailoredPath, changes, matchScore }
  ← CLI prints diff and summary
```

### `wolf file --job <job_id> --dry-run`

```
CLI parses args
  → file({ jobId: "abc123", dryRun: true })
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

### User config directory (`~/.wolf/`)

Created by `wolf init`. Not checked into git.

```
~/.wolf/
├── config.json       # User preferences (roles, locations, resume path)
└── credentials/      # OAuth tokens (Gmail), gitignored
```

### Runtime data directory (`wolf/data/`)

Local database and generated files. Gitignored.

```
data/
├── wolf.sqlite       # Job listings, statuses, scores
├── tailored/         # Generated tailored resumes
├── screenshots/      # Form fill audit screenshots
└── outreach/         # Draft outreach emails
```

## Inter-Component Communication

Commands do not call each other directly. **SQLite is the shared communication bus.**

Each command reads input from the database, does its work, and writes results back:

```
hunt()   ── writes → [SQLite: jobs table] ── reads → tailor()
tailor() ── writes → [SQLite: tailored_resume_path] ── reads → file()
file()   ── writes → [SQLite: status="applied"] ── reads → reach()
reach()  ── writes → [SQLite: outreach_draft_path]
```

Concrete example:

```typescript
// hunt: save discovered jobs
db.saveJob({ id: "abc", title: "SDE", company: "Google", status: "new", score: 0.9 })

// tailor: read job, write tailored resume path back
const job = db.getJob("abc")
db.updateJob("abc", { tailoredResumePath: "./data/tailored/abc.md" })

// file: read job + resume path, update status
const job = db.getJob("abc")  // has job.url + job.tailoredResumePath
db.updateJob("abc", { status: "applied", screenshotPath: "./data/screenshots/abc.png" })

// reach: read job, write outreach draft
const job = db.getJob("abc")  // has job.company, job.title
db.updateJob("abc", { outreachDraft: "./data/outreach/abc.md" })
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
│  [Execute: wolf file --dry-run]                    │
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
│  [State: apply]      → call wolf_file        │
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

- **API keys** stored in `.env`, never committed (covered by `.gitignore`)
- **Gmail OAuth tokens** stored in `~/.wolf/credentials/`, never committed
- **Form filling** defaults to dry-run; explicit `--no-dry-run` or confirmation required for live submission
- **Email sending** requires `--send` flag plus interactive confirmation
- **No data leaves the machine** except through explicit API calls (Apify, Claude, Gmail)

## Testing Strategy

- **Unit tests** for `src/commands/` — mock external services, test business logic
- **Integration tests** for CLI and MCP layers — verify argument parsing and output formatting
- **E2E tests** for `wolf file` — Playwright tests against sample forms
- Test runner: vitest (lightweight, TypeScript-native)
