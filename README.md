# wolf

**W**orkflow of **O**utreaching, **L**inkedIn & **F**illing

> **🚧 Under active development** — wolf is currently in **Milestone 1 (Scaffolding & Skeleton)**. Core CLI and MCP interfaces are being wired up. See the [Roadmap](#roadmap) below for what's planned.

AI-powered job hunting workflow that finds roles, tailors your resume, and reaches out — automatically. Runs as both a **CLI tool** and an **MCP server**, so it can be invoked by other agents such as [OpenClaw](https://github.com/guanyu-tao/OpenClaw).

## What wolf does

| Command | Description |
|---|---|
| `wolf hunt` | Scrape LinkedIn & Handshake, score jobs against your profile |
| `wolf tailor` | Rewrite resume bullets to match a JD, compile to PDF |
| `wolf fill` | Auto-fill job application forms via Playwright |
| `wolf reach` | Find HR contacts, draft & send personalized outreach |
| `wolf status` | Track all jobs with status, score, and filters |

## Roadmap

| # | Milestone | Summary | Status |
|---|---|---|---|
| 1 | Scaffolding & Skeleton | CLI + MCP server runnable, all subcommands registered (stubs) | **In progress** |
| 2 | Hunter | Job scraping, scoring, dedup, local DB | Planned |
| 3 | Resume Tailor | AI-powered resume rewriting + LaTeX → PDF | Planned |
| 4 | Form Prefill | Playwright-based application form auto-fill | Planned |
| 5 | Outreach | Contact finder + cold email drafting via Gmail | Planned |

Full details → [`docs/MILESTONES.md`](docs/MILESTONES.md)

## Project structure

```
wolf/
├── src/
│   ├── cli/          # Commander.js CLI entry point & subcommands
│   ├── mcp/          # MCP server entry point & tool definitions
│   ├── commands/     # Core logic: hunt, tailor, fill, reach, status
│   ├── types/        # Shared types (Job, Resume, AppConfig)
│   └── utils/        # Shared helpers
├── docs/             # Project documentation (see below)
├── data/             # Local DB & runtime data (gitignored)
├── CLAUDE.md         # AI-facing project context
└── package.json
```

## Documentation

| Document | What's inside |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, module relationships, data flow diagram |
| [`docs/MILESTONES.md`](docs/MILESTONES.md) | Full milestone plan with task checklists |
| [`docs/API.md`](docs/API.md) | CLI & MCP tool reference — params, returns, examples |
| [`docs/TYPES.md`](docs/TYPES.md) | All shared TypeScript types with descriptions |
| [`docs/SCOPE.md`](docs/SCOPE.md) | What wolf does and does NOT do |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Technical decision log (e.g. "Why SQLite?") |
| [`CLAUDE.md`](CLAUDE.md) | AI-facing context — auto-read by Claude Code |

> All docs (except `CLAUDE.md` and `README.md`) have a Chinese version with `_zh` suffix.

## Tech stack

| Layer | Tool |
|---|---|
| Language | TypeScript + Node.js |
| CLI | commander.js |
| MCP server | MCP SDK |
| Job scraping | Apify (LinkedIn, Handshake) |
| AI | Claude API (Anthropic SDK) |
| Resume | LaTeX (xelatex) → PDF |
| Cover letter | md-to-pdf (Markdown → PDF) |
| Browser automation | Playwright |
| Local storage | SQLite |
| Email | Gmail API (OAuth2) |

## Quick start

```bash
# Install dependencies
npm install

# Build and install globally
npm run build
npm install -g .

# Set up your workspace (creates wolf.toml, resume/, data/)
mkdir my-job-search && cd my-job-search
wolf init

# Configure API keys (written to ~/.zshrc)
wolf env set

# Run CLI
wolf --help

# Start MCP server
wolf mcp serve
```

## License

MIT
