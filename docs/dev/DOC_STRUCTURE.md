# Project Documentation Structure

## For humans

| File | Purpose |
|---|---|
| `README.md` | What the project is, how to install, how to use. First impression. |
| `CONTRIBUTING.md` | How to contribute — branch naming, PR flow, commit format. |
| `CHANGELOG.md` | What changed in each version. For users. |
| `docs/ARCHITECTURE.md` | System design, module relationships, technical decisions and reasoning. |
| `docs/API.md` | Full reference for every command/tool — params, return values, examples. |

## For AI

| File | Purpose |
|---|---|
| `CLAUDE.md` | Project structure, current milestone, common commands. Auto-read by Claude Code. |

## For project definition

| File | Purpose |
|---|---|
| `docs/DECISIONS.md` | Log of important technical decisions and why. e.g. "Why SQLite over MongoDB". |
| `docs/SCOPE.md` | What the project does and explicitly does NOT do. Prevents scope creep. |

## Priority for wolf

**Start now:**
- `README.md`
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`

**Add when collaborating:**
- `CONTRIBUTING.md`
- `docs/API.md`

**Start anytime, one entry per decision:**
- `docs/DECISIONS.md`