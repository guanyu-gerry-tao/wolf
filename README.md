# wolf

**W**orkflow of **O**utreaching, **L**inkedIn & **F**illing

> **🚧 Under active development** — wolf is currently in **Milestone 1 (Scaffolding & Skeleton)**. Core CLI and MCP interfaces are being wired up. See the [Roadmap](#roadmap) below for what's planned.

AI-powered job hunting workflow that finds roles, tailors your resume, and reaches out — automatically. Runs as both a **CLI tool** and an **MCP server**, so it can be invoked by other agents such as [OpenClaw](https://github.com/guanyu-tao/OpenClaw).

## Contributing

wolf is open source and welcomes contributions. Whether you're fixing a bug, implementing a feature, or improving docs — all are welcome.

- English guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- 中文指南: [CONTRIBUTING_zh.md](CONTRIBUTING_zh.md)

## What wolf does

| Command | Description |
|---|---|
| `wolf hunt` | Find, filter, and score job listings against your profile |
| `wolf tailor` | Rewrite resume bullets to match a JD, compile to PDF |
| `wolf fill` | Auto-fill job application forms via Playwright |
| `wolf reach` | Find HR contacts, draft & send personalized outreach |
| `wolf status` | Track all jobs with status, score, and filters |

## Roadmap

| # | Milestone | Summary | Status |
|---|---|---|---|
| 1 | Scaffolding & Skeleton | CLI + MCP server runnable, all subcommands registered (stubs) | **In progress** |
| 2 | Hunter | Job ingestion, AI scoring, dedup, local DB | Planned |
| 3 | Resume Tailor | AI-powered resume rewriting + HTML → PDF (Playwright) | Planned |
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
| Job data | Pluggable provider system |
| AI | Claude API (Anthropic SDK) |
| Resume + cover letter | HTML → PDF via Playwright Chromium (resume fit-loop over font-size / line-height / margin) |
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

### Quick start — dev build (for contributors)

If you're hacking on wolf itself, use the dev build so your code changes never touch your real `~/wolf` workspace or your production API key. See [CONTRIBUTING.md](CONTRIBUTING.md) "Step 3.5" for the full contract.

```bash
npm install
npm run build:dev

export WOLF_DEV_HOME=~/wolf-dev                # any directory you want for testing
export WOLF_DEV_ANTHROPIC_API_KEY=sk-ant-...   # separate from your production key

npm run wolf -- init --dev --empty             # create a dev workspace (no prompts)
npm run wolf -- <command>                      # run any wolf command against the dev build
```

## License

MIT
