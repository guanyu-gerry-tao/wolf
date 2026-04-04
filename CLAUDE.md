# CLAUDE.md — wolf

## What is wolf

**W**orkflow of **O**utreaching, **L**inkedIn & **F**illing

AI-powered job hunting CLI + MCP server. Finds roles, tailors resumes, fills forms, and sends outreach emails. Can be invoked by other agents (e.g. OpenClaw).

## Current milestone

**Milestone 1 — Scaffolding & Skeleton** (in progress)

Goal: wolf is runnable as both a CLI and an MCP server, all subcommands registered (stubs ok).

See [docs/overview/MILESTONES.md](docs/overview/MILESTONES.md) for full milestone plan.

## Project structure (planned)

```
wolf/
├── src/
│   ├── cli/          # commander.js CLI entry point and subcommands
│   ├── mcp/          # MCP server entry point and tool definitions
│   ├── commands/
│   │   ├── hunt/     # Provider system, scorer, dedup
│   │   ├── tailor/   # Resume parser, Claude prompt, diff
│   │   ├── fill/     # Playwright, form detection, submit
│   │   ├── reach/    # Contact finder, email drafter, Gmail sender
│   │   └── status/   # Job list, filters
│   ├── types/        # Shared types: Job, Resume, AppConfig
│   └── utils/        # Shared helpers
├── data/             # Local DB and runtime data (gitignored)
├── docs/             # Project documentation
├── CLAUDE.md         # This file
└── package.json
```

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

## Testing conventions

- Unit test files go in a `__tests__/` folder adjacent to the source they test
  - e.g. `src/utils/__tests__/config.test.ts` tests `src/utils/config.ts`
  - e.g. `src/commands/env/__tests__/env.test.ts` tests `src/commands/env/index.ts`
- Test files are named `<subject>.test.ts`
- Use Vitest; run with `npm test`

## Workflow rules

- Do NOT commit or push without explicit user approval. Always show changes and wait for confirmation first.
- When a significant design decision is made during conversation, ask the user: "Should we record this in DECISIONS.md?" (This rule itself is recorded in docs/design/DECISIONS.md — 2026-03-20.)

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
