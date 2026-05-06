# wolf

**W**orkflow of **O**utreaching, **L**inkedIn & **F**illing

> **🚧 Under active development** — Milestone 1 (scaffolding) and Milestone 3 (tailor) are complete. The current line of work is Milestone 2: job ingestion and scoring.

AI-powered job hunting workflow that finds roles, tailors your resume, and reaches out — automatically. Runs as both a **CLI tool** and an **MCP server**, so it can be invoked by other agents such as [OpenClaw](https://github.com/guanyu-tao/OpenClaw).

## Contributing

wolf is open source and welcomes contributions. Whether you're fixing a bug, implementing a feature, or improving docs — all are welcome.

- English guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- 中文指南: [CONTRIBUTING_zh.md](CONTRIBUTING_zh.md)

## What wolf does

| Command | Description |
|---|---|
| `wolf init` | Create a workspace and profile scaffold |
| `wolf add` | Add a job manually from structured title/company/JD text |
| `wolf score` | Score or tier saved jobs against the active profile |
| `wolf tailor` | Rewrite resume bullets and cover letter to match a JD, compile to PDF |
| `wolf status` | Track job counts by status |
| `wolf job ...` | List, show, read, and update tracked job fields |
| `wolf profile ...` | Show, read, update, and extend `profile.toml` |
| `wolf hunt` / `wolf fill` / `wolf reach` | Registered roadmap commands; currently print "not yet available" |

## Roadmap

| # | Milestone | Summary | Status |
|---|---|---|---|
| 1 | Scaffolding & Skeleton | CLI + MCP server runnable, all subcommands registered | Done |
| 2 | Hunter | Job ingestion, AI scoring, dedup, local DB | In progress |
| 3 | Resume Tailor | AI-powered resume rewriting + HTML → PDF (Playwright) | Done |
| 4 | Form Prefill | Playwright-based application form auto-fill | Planned |
| 5 | Outreach | Contact finder + cold email drafting via Gmail | Planned |

Full details → [`docs/overview/MILESTONES.md`](docs/overview/MILESTONES.md)

## Project structure

```
wolf/
├── src/
│   ├── cli/          # Commander.js CLI entry + thin command wrappers
│   ├── mcp/          # MCP server entry + tool definitions
│   ├── serve/        # Local HTTP daemon for companion/browser workflows
│   ├── application/  # Use-case orchestration
│   ├── service/      # Domain services: AI, scoring, rendering, fill helpers
│   ├── repository/   # SQLite and workspace-file access
│   ├── runtime/      # Shared DI container
│   └── utils/        # Shared helpers, types, schemas, errors
├── docs/             # Project documentation (see below)
├── data/             # Local DB & runtime data (gitignored)
├── CLAUDE.md         # AI-facing project context
└── package.json
```

## Documentation

| Document | What's inside |
|---|---|
| [`docs/design/ARCHITECTURE.md`](docs/design/ARCHITECTURE.md) | System design, module relationships, data flow diagram |
| [`docs/overview/MILESTONES.md`](docs/overview/MILESTONES.md) | Full milestone plan with task checklists |
| [`docs/dev/API.md`](docs/dev/API.md) | CLI & MCP tool reference — params, returns, examples |
| [`docs/design/DATA_LAYOUT.md`](docs/design/DATA_LAYOUT.md) | Workspace files, SQLite boundaries, and artifact paths |
| [`docs/overview/SCOPE.md`](docs/overview/SCOPE.md) | What wolf does and does NOT do |
| [`docs/design/DECISIONS.md`](docs/design/DECISIONS.md) | Technical decision log (e.g. "Why SQLite?") |
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

## Quick start (5 minutes)

> Requires Node.js 20 LTS or newer.

```bash
# 1. Install
npm install -g @gerryt/wolf

# 2. Configure your Anthropic API key (get one at https://console.anthropic.com/)
wolf env set

# 3. Create a workspace (defaults to ~/wolf)
wolf init

# 4. Fill in your profile (REQUIRED before tailor will run)
#    Edit the profile TOML in any text editor, or use `wolf profile set/add`:
#      ~/wolf/profiles/default/profile.toml         # identity, resume pool,
#                                                   # work auth, Q&A, scoring notes

# 5. Sanity-check that the profile is filled enough to tailor
wolf doctor

# 6. Add a job (paste the JD text)
wolf add -t "Senior Backend Engineer" -c "Acme Corp" -j "$(pbpaste)"
# returns a jobId — copy it for the next step

# 7. Tailor a resume + cover letter for that job
wolf tailor full -j <jobId>
# outputs: ~/wolf/data/jobs/<jobId>/resume.pdf + cover_letter.pdf
```

The first `wolf tailor` run downloads Playwright Chromium (~150 MB, one-time)
to render the PDFs. Subsequent runs reuse it.

### What's not yet available

`wolf hunt`, `wolf fill`, and `wolf reach` are registered in `wolf --help`
but are still on the roadmap — they print "not yet available" and exit. `wolf
score` is available for triaging saved jobs. See
[`docs/overview/MILESTONES.md`](docs/overview/MILESTONES.md) for the timeline.
The available end-to-end path today is **add → score/tailor → use the generated
PDFs to apply manually**.

### MCP server

```bash
wolf mcp serve
```

Use this from Claude Desktop, OpenClaw, or any MCP-aware AI orchestrator.

### Hacking on wolf (dev build)

If you're contributing, use the dev build so your code changes never touch
your real `~/wolf` workspace or production API key. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full contract.

```bash
git clone https://github.com/guanyu-gerry-tao/wolf.git && cd wolf
npm install
npm run build:dev
npm link                                       # installs `wolf-dev` globally

export WOLF_DEV_HOME=~/wolf-dev                # separate workspace
export WOLF_DEV_ANTHROPIC_API_KEY=sk-ant-...   # separate API key

wolf-dev init --preset empty                    # create dev workspace
wolf-dev <command>                             # run any wolf command in dev mode
```

The dev binary `wolf-dev` and the stable `wolf` coexist on your PATH —
dogfood the stable npm release at the same time as you iterate on dev.

## License

MIT
