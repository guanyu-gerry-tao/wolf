# AGENTS.md — wolf

## What is wolf

**W**orkflow of **O**utreaching, **L**inkedIn & **F**illing

AI-powered job hunting CLI + MCP server. Finds roles, tailors resumes, fills forms, and sends outreach emails. Can be invoked by other agents (e.g. OpenClaw).

## Current milestone

**Milestone 1 — Scaffolding & Skeleton** ✅ complete
**Milestone 3 — Tailor** ✅ complete (HTML→PDF pipeline, 3-agent checkpoint flow, CLI tooling)

Post-M3 enhancement batch done: E1 (willingToRelocate string), E2 (per-command model + combined provider/model format), E3 (wolf config/profile get/set + multi-profile management), E4 (prompts externalized to MD), E5/E6 (prompt polish), E7 (analyst + writers checkpoint architecture with hint.md), E8 (profile governance consolidated into `profile.toml` with `wolf profile` show/get/set/fields/add/remove, unified builtin questions, `assertReadyForTailor`, and `wolf doctor` content-shape validation).

**Next: Milestone 2 — Hunter** (application layer + hunt/score commands)

See [docs/overview/MILESTONES.md](docs/overview/MILESTONES.md) for full milestone plan.

## Project structure

```
wolf/
├── src/
│   ├── cli/                  # CLI entry + thin command wrappers
│   │   ├── index.ts              # commander.js setup
│   │   └── commands/             # one file per verb; each wrapper is ~1 line + formatter
│   ├── mcp/                  # MCP entry (calls into the same application layer)
│   ├── runtime/              # Shared DI container
│   │   └── appContext.ts         # wires every repo + service + application service
│   ├── application/          # Application services — use-case orchestration
│   │   ├── <name>ApplicationService.ts   # interface
│   │   └── impl/                          # implementations + init templates/
│   ├── service/              # Domain services — single-responsibility business ops
│   │   ├── ai/                            # AI provider registry (was utils/ai/)
│   │   ├── <name>Service.ts               # interface
│   │   └── impl/                          # implementations + prompts/, render/
│   ├── repository/           # Data access — SQLite + workspace file I/O
│   │   ├── <name>Repository.ts            # interface
│   │   └── impl/                          # concrete backends
│   └── utils/                # Cross-cutting helpers (logger, config, env)
│       ├── types/                         # Shared domain types
│       └── errors/                        # Typed custom error classes
├── data/                     # Local DB and runtime data (gitignored)
├── docs/
└── package.json
```

**Layer dependency direction:** `cli → application → service → repository → utils`. Each layer may only depend on the layers below it. Every CLI command — even three-line ones — routes through an application service; nothing is inlined in the wrapper.

**DI entry point:** `src/runtime/appContext.ts` constructs every implementation and exposes them on `AppContext`. Both `cli/` and `mcp/` consume the same context. Swap real for mock by changing that one file — nothing else.

## Tech stack

| Layer | Tool |
|---|---|
| Language | TypeScript + Node.js |
| CLI framework | commander.js |
| MCP server | MCP SDK |
| Job data | Pluggable provider system |
| AI | Codex API (anthropic SDK) |
| Resume + cover letter rendering | HTML → PDF via Playwright Chromium (resume runs a fit-loop binary search over font-size / line-height / margin to fit one page) |
| Browser automation | Playwright |
| Local storage | SQLite |
| Email | Gmail API (OAuth2) |
| Config | `wolf.toml` in workspace root |

## CLI commands

| Command | Description |
|---|---|
| `wolf init` | Interactive setup wizard; defaults to `~/wolf` |
| `wolf init --preset empty` | Dev non-interactive blank skeleton workspace (tests use `WOLF_DEV_HOME=/tmp/wolf-test/<suite>/<run-id>/workspaces/<workspace-id>`) |
| `wolf init --preset default` | Dev non-interactive demo workspace with John Smith profile data and empty SQLite job/search storage |
| `wolf hunt` | Find and score jobs |
| `wolf tailor` | Tailor resume to a JD |
| `wolf fill` | Auto-fill job application form |
| `wolf reach` | Find HR contacts and send outreach |
| `wolf status` | Dashboard summary: one count per module (tracked, tailored, applied, ...) |
| `wolf job list` | List tracked jobs with `--search` (repeatable), `--status`, `--min-score`, `--source`, `--start`/`--end` range; default limit 20 |
| `wolf env show` | List WOLF_* keys and whether they are set |
| `wolf env clear` | Remove WOLF_* export lines from shell RC files |

## MCP tools

Stable: `wolf_hunt`, `wolf_tailor`, `wolf_fill`, `wolf_reach`. Dev builds expose `wolfdev_*` names.

## Environment variables

API keys use a `WOLF_` prefix and are stored as shell environment variables (not in `.env` files — workspace may be cloud-synced or shared with resumes). Use `wolf env set` to configure them.

```
WOLF_ANTHROPIC_API_KEY=
WOLF_APIFY_API_TOKEN=
WOLF_GMAIL_CLIENT_ID=
WOLF_GMAIL_CLIENT_SECRET=
WOLF_HOME=
WOLF_DEV_HOME=
WOLF_DEV_ANTHROPIC_API_KEY=
```

Add to `~/.zshrc` (Mac/Linux) or User Environment Variables (Windows).
Run `wolf env show` to verify, `wolf env clear` to remove.

For MCP server usage, add these to the `env` section of `claude_desktop_config.json`.

## Naming conventions

- **File names:** camelCase (`batchServiceImpl.ts`, `fileProfileRepositoryImpl.ts`). Never PascalCase for non-component files, never kebab-case.
- **Symbol names:** PascalCase for classes/interfaces/types (`BatchService`, `JobRepository`), camelCase for functions and values.
- **File name = main exported symbol name**, first letter lower-cased.

### Interface / implementation layering

- Interfaces live in the layer root and carry the layer suffix: `service/batchService.ts` exports `interface BatchService`; `repository/profileRepository.ts` exports `interface ProfileRepository`; `application/tailorApplicationService.ts` exports `interface TailorApplicationService`.
- Implementations live in `impl/` and **always** end with `Impl`:
  - Single implementation: `<interface>Impl` → `batchServiceImpl.ts` exports `class BatchServiceImpl`.
  - Multiple implementations: `<qualifier><interface>Impl` → `fileProfileRepositoryImpl.ts` exports `class FileProfileRepositoryImpl`, `inMemoryProfileRepositoryImpl.ts` exports `class InMemoryProfileRepositoryImpl`.
- Qualifier says *which kind* of implementation (`File`, `InMemory`, `Sqlite`, `Api`, `Http`, …). `Impl` says *this is an implementation*. Both signals are carried explicitly — every class ending in `Impl` is grep-discoverable.
- Do NOT use `I` prefix on interfaces (`IBatchService` is C#/Java-style; TS community has moved away from it).

### Import style

- Use `import type { ... }` for any import used **only** as a type (interface references, generic parameters, `implements` clauses). The import is erased at compile time — no runtime cost, no accidental module side effects, and loops are broken.
- Use regular `import { ... }` only for values you actually reference at runtime (`new SomeImpl()`, calling a function, etc.).

## Testing conventions

- Unit test files go in a `__tests__/` folder adjacent to the source they test
  - e.g. `src/utils/__tests__/config.test.ts` tests `src/utils/config.ts`
  - e.g. `src/cli/commands/__tests__/env.test.ts` tests `src/cli/commands/env.ts`
- Test files are named `<subject>.test.ts`
- Use Vitest; run with `npm test`
- Smoke and acceptance test definitions live under `test/`; start with `test/README.md`.
- Shared offline JD and resume inputs live under `test/fixtures/`; use the fixture scripts there instead of embedding large pasted text in acceptance docs.
- CLI behavior added or changed → add or update the relevant smoke/acceptance group under `test/` in the same PR.
- Automated smoke and acceptance tests must only use `/tmp/wolf-test/` workspaces via explicit `WOLF_DEV_HOME=/tmp/wolf-test/<suite>/<run-id>/workspaces/<workspace-id>`.
- When running smoke or acceptance suites, the AI agent must act as the
  orchestrator: split work by suite group, assign subagents to execute those
  groups, and collect their reports into `test/runs/<run-id>/`.
- Smoke subagents should use the cheapest capable model tier (Haiku-like or
  GPT-mini-like). Acceptance subagents should use a mid-tier capable model
  (Claude Sonnet-like or GPT-5.4-like), especially for API-backed or
  AI-reviewed groups.
- Test run reports live under `test/runs/<run-id>/`, with `test/runs/LATEST.md` pointing to the most recent run. The directory is kept with `.gitkeep`, but run contents are gitignored and must not be committed.
- If the user asks to clear test tmp/temp files, interpret that as deleting runtime workspaces under `/tmp/wolf-test/` only. Do not delete `test/runs/` reports unless the user explicitly asks to clear reports too.

### Comment style

- **Tests:** Write thorough English comments. Every `describe`, `it`, helper function, and non-obvious assertion should have a comment explaining *what scenario is being tested and why*. A reader should understand the test's intent without reading the implementation.
- **Implementation:** Add single-line English comments before logical blocks to explain intent. Do not add comments after a line of code — always on the line above. Keep it concise; explain *why*, not *what*.

## Workflow rules

- Do NOT commit or push without explicit user approval. Always show changes and wait for confirmation first.
- When a significant design decision is made during conversation, ask the user: "Should we record this in DECISIONS.md?" (This rule itself is recorded in docs/design/DECISIONS.md — 2026-03-20.)
- **Docs travel with code.** Any PR that changes layers, directories, interfaces, or architectural decisions must include the corresponding doc updates in the same PR. Use this mapping:
  - Layer / directory / data flow changed → `ARCHITECTURE.md` + `ARCHITECTURE_zh.md`
  - Architectural decision made → `DECISIONS.md` + `DECISIONS_zh.md`
  - Milestone status changed → `AGENTS.md`
  - Testing conventions changed → `test/README.md` + `test/README_zh.md` and the relevant suite/group docs

## Implementation plans

- Plans (from `superpowers:writing-plans` or similar) go in `docs/plans/`
- `docs/plans/` is gitignored except for `.gitkeep` — plans are personal working docs, not shared
- Naming convention: `YYYY-MM-DD-<feature-name>.md`

## Documentation rules

- All markdown documents (except `AGENTS.md` and `README.md`) MUST have a Chinese version with `_zh` suffix (e.g., `ARCHITECTURE.md` → `ARCHITECTURE_zh.md`)
- When creating or updating an English doc, always create or update the corresponding `_zh` version in the same commit
- Chinese versions must stay in sync with their English counterparts

## Workspace migrations

wolf is in `0.x` — workspace format is **not stable**. Whenever you make a
breaking change to any of the surfaces below, you **must also land a
migration framework in the same PR**. Don't defer it.

Surfaces that count as workspace state:
- `wolf.toml` schema (renamed/removed fields, new required fields)
- `profiles/<name>/profile.toml` shape (required fields, array-of-table entry
  layout, builtin question ids, structured field names)
- SQLite schema (any non-additive change — column rename, drop, type change, table rename)
- `data/jobs/<dir>/` artifact layout (filenames, directory structure)

Migration contract:
- New code reads a `schema_version` field; runs ordered migrations from the workspace's recorded version up to the current one.
- Missing `schema_version` is treated as v1 (the pre-migration baseline).
- **New code migrates old data.** Old code is never patched retroactively to "prepare" for a future format.

Until the first migration framework lands, every breaking change requires a
`### Breaking changes` section in `CHANGELOG.md` with explicit re-init guidance.

## Releasing (stable npm)

Stable release = publish a new `@gerryt/wolf@0.x.y` to npm. Hard gates,
all four mandatory:

- (a) Full smoke + acceptance pass, **including AI-paid acceptance groups**.
- (b) Git tag `v0.x.y` matching `package.stable.json#version` exists.
- (c) `CHANGELOG.md` updated with a `## v0.x.y — YYYY-MM-DD` heading.
- (d) Branch is `main`, working tree clean.

Procedure: bump version + CHANGELOG → tag → `npm run publish:stable` (stages
`dist-package/` and stops before `npm publish`) → human runs `npm publish` →
fresh-shell verification → push tag → GitHub release.

Failure recovery: `npm unpublish` within 72h, else `deprecate`. Same version
number can never be re-published.

Never run `npm publish` in an automated context. The agent prepares; the
human publishes.

## Common commands

```bash
npm run build       # compile TypeScript
npm run dev         # run in watch mode
npm run test        # run tests
wolf --help         # CLI help
wolf mcp serve      # start MCP server
```
