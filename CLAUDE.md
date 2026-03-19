# CLAUDE.md — wolf

## What is wolf

**W**orkflow of **O**utreaching, **L**inkedIn & **F**illing

AI-powered job hunting CLI + MCP server. Finds roles, tailors resumes, fills forms, and sends outreach emails. Can be invoked by other agents (e.g. OpenClaw).

## Current milestone

**Milestone 1 — Scaffolding & Skeleton** (in progress)

Goal: wolf is runnable as both a CLI and an MCP server, all subcommands registered (stubs ok).

See [docs/MILESTONES.md](docs/MILESTONES.md) for full milestone plan.

## Project structure (planned)

```
wolf/
├── src/
│   ├── cli/          # commander.js CLI entry point and subcommands
│   ├── mcp/          # MCP server entry point and tool definitions
│   ├── commands/
│   │   ├── hunt/     # Scraper, scorer, dedup
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
| Job scraping | Apify (LinkedIn, Handshake) |
| AI | Claude API (anthropic SDK) |
| Resume rendering | LaTeX (xelatex) → PDF |
| Cover letter rendering | md-to-pdf (Markdown → PDF) |
| Browser automation | Playwright |
| Local storage | SQLite |
| Email | Gmail API (OAuth2) |
| Config | `~/.wolf/config.json` + `.env` |

## CLI commands

| Command | Description |
|---|---|
| `wolf init` | Interactive setup wizard |
| `wolf hunt` | Find and score jobs |
| `wolf tailor` | Tailor resume to a JD |
| `wolf fill` | Auto-fill job application form |
| `wolf reach` | Find HR contacts and send outreach |
| `wolf status` | List tracked jobs with status/score |

## MCP tools

`wolf_hunt`, `wolf_tailor`, `wolf_fill`, `wolf_reach`

## Environment variables

```
ANTHROPIC_API_KEY=
APIFY_API_TOKEN=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
```

## Workflow rules

- Do NOT commit or push without explicit user approval. Always show changes and wait for confirmation first.

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
