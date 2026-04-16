# CLAUDE.md — wolf

## What is wolf

**W**orkflow of **O**utreaching, **L**inkedIn & **F**illing

AI-powered job hunting CLI + MCP server. Finds roles, tailors resumes, fills forms, and sends outreach emails. Can be invoked by other agents (e.g. OpenClaw).

## Current milestone

**Milestone 1 — Scaffolding & Skeleton** ✅ complete

**Next: Milestone 2 — Hunter** (application layer + hunt/score commands)

See [docs/overview/MILESTONES.md](docs/overview/MILESTONES.md) for full milestone plan.

## Project structure

```
wolf/
├── src/
│   ├── cli/              # CLI entry + AppContext (DI container)
│   │   ├── index.ts          # commander.js setup, parses args, calls AppContext
│   │   └── appContext.ts     # manual DI — wires repo + service + application
│   ├── mcp/              # MCP entry — paused for this milestone
│   ├── commands/         # Thin wrappers between CLI and application layer
│   │   ├── hunt/
│   │   ├── tailor/
│   │   ├── fill/
│   │   ├── reach/
│   │   ├── score/
│   │   └── status/
│   ├── application/      # Application services — use-case orchestration
│   │   ├── <name>.ts         # interface
│   │   ├── impl/             # real + mock implementations
│   │   └── model/            # DTOs returned by application services
│   ├── service/          # Domain services — single-responsibility business ops
│   │   ├── <name>.ts         # interface
│   │   ├── impl/             # real + mock implementations
│   │   └── model/            # DTOs returned by domain services
│   ├── repository/       # Data access — SQLite + workspace file I/O
│   │   ├── <name>.ts         # interface
│   │   └── impl/             # concrete backends
│   ├── errors/           # Typed custom error classes
│   ├── types/            # Shared domain types (Job, Company, UserProfile, ...)
│   └── utils/            # Cross-cutting helpers (logger, config, env) — not a layer
├── data/                 # Local DB and runtime data (gitignored)
├── docs/
└── package.json
```

**Layer dependency direction:** `CLI/Commands → Application → Service → Repository → Types`. Each layer may only depend on the layers below it.

**DI entry point:** `src/cli/appContext.ts` constructs all implementations and provides them to commands. Swap real for mock by changing that one file — nothing else.

**MCP is paused.** When reactivated, it will sit next to `src/cli/`, also call `createAppContext()`, and delegate to the same application layer.

## Tech stack

| Layer | Tool |
|---|---|
| Language | TypeScript + Node.js |
| CLI framework | commander.js |
| MCP server | MCP SDK |
| Job data | Pluggable provider system |
| AI | Claude API (anthropic SDK) |
| Resume rendering | LaTeX (xelatex) → PDF |
| Cover letter rendering | md-to-pdf (Markdown → PDF) |
| Browser automation | Playwright |
| Local storage | SQLite |
| Email | Gmail API (OAuth2) |
| Config | `wolf.toml` in workspace root |

## CLI commands

| Command | Description |
|---|---|
| `wolf init` | Interactive setup wizard |
| `wolf hunt` | Find and score jobs |
| `wolf tailor` | Tailor resume to a JD |
| `wolf fill` | Auto-fill job application form |
| `wolf reach` | Find HR contacts and send outreach |
| `wolf status` | List tracked jobs with status/score |
| `wolf env show` | List WOLF_* keys and whether they are set |
| `wolf env clear` | Remove WOLF_* export lines from shell RC files |

## MCP tools

`wolf_hunt`, `wolf_tailor`, `wolf_fill`, `wolf_reach`

## Environment variables

API keys use a `WOLF_` prefix and are stored as shell environment variables (not in `.env` files — workspace may be cloud-synced or shared with resumes). Use `wolf env set` to configure them.

```
WOLF_ANTHROPIC_API_KEY=
WOLF_APIFY_API_TOKEN=
WOLF_GMAIL_CLIENT_ID=
WOLF_GMAIL_CLIENT_SECRET=
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
  - e.g. `src/commands/env/__tests__/env.test.ts` tests `src/commands/env/index.ts`
- Test files are named `<subject>.test.ts`
- Use Vitest; run with `npm test`

### Comment style

- **Tests:** Write thorough English comments. Every `describe`, `it`, helper function, and non-obvious assertion should have a comment explaining *what scenario is being tested and why*. A reader should understand the test's intent without reading the implementation.
- **Implementation:** Add single-line English comments before logical blocks to explain intent. Do not add comments after a line of code — always on the line above. Keep it concise; explain *why*, not *what*.

## Workflow rules

- Do NOT commit or push without explicit user approval. Always show changes and wait for confirmation first.
- When a significant design decision is made during conversation, ask the user: "Should we record this in DECISIONS.md?" (This rule itself is recorded in docs/design/DECISIONS.md — 2026-03-20.)
- **Docs travel with code.** Any PR that changes layers, directories, interfaces, or architectural decisions must include the corresponding doc updates in the same PR. Use this mapping:
  - Layer / directory / data flow changed → `ARCHITECTURE.md` + `ARCHITECTURE_zh.md`
  - Architectural decision made → `DECISIONS.md` + `DECISIONS_zh.md`
  - Milestone status changed → `CLAUDE.md`
  - Testing conventions changed → `TESTING.md` + `TESTING_zh.md`

## Implementation plans

- Plans (from `superpowers:writing-plans` or similar) go in `docs/plans/`
- `docs/plans/` is gitignored except for `.gitkeep` — plans are personal working docs, not shared
- Naming convention: `YYYY-MM-DD-<feature-name>.md`

## Documentation rules

- All markdown documents (except `CLAUDE.md` and `README.md`) MUST have a Chinese version with `_zh` suffix (e.g., `ARCHITECTURE.md` → `ARCHITECTURE_zh.md`)
- When creating or updating an English doc, always create or update the corresponding `_zh` version in the same commit
- Chinese versions must stay in sync with their English counterparts

## Common commands

```bash
npm run build       # compile TypeScript
npm run dev         # run in watch mode
npm run test        # run tests
wolf --help         # CLI help
wolf mcp serve      # start MCP server
```
