# Contributing to wolf

Welcome! This guide will walk you through everything you need to start contributing to wolf. No prior experience with TypeScript projects is assumed — every step includes the exact commands to run.

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/guanyu-gerry-tao/wolf.git
cd wolf

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Run in dev mode (auto-recompile on changes)
npm run dev

# 5. Run tests
npm run test
```

> **Note:** If `npm install` fails, make sure you have **Node.js 18+** installed. Run `node -v` to check.

---

## Branch & PR Flow

All changes go through pull requests. **Never push directly to `main`.**

### Branch naming

Use this format: `<type>/<short-name>`

| Prefix | When to use | Example |
|---|---|---|
| `feat/` | New feature | `feat/hunt-scoring` |
| `fix/` | Bug fix | `fix/config-crash` |
| `docs/` | Documentation only | `docs/add-api-reference` |
| `refactor/` | Code restructure, no behavior change | `refactor/extract-provider` |
| `test/` | Adding or fixing tests | `test/hunt-unit-tests` |
| `chore/` | Tooling, CI, dependencies | `chore/add-eslint` |

### Creating a branch and PR

```bash
# Create a new branch
git checkout -b feat/my-feature

# Make your changes, then stage and commit
git add src/commands/hunt.ts
git commit -m "feat: add job deduplication logic"

# Push to remote
git push -u origin feat/my-feature

# Create a PR on GitHub (or use the GitHub web UI)
gh pr create --title "feat: add job deduplication" --body "Closes #12"
```

### PR review rules

| Who opened the PR | Who needs to approve |
|---|---|
| Project owner | Self-approve is fine |
| Other collaborators | Project owner must approve |
| Fork contributors | Project owner must approve |

---

## Commit Convention

Format: `<type>: <short description>`

```
feat: add LinkedIn scraper integration
fix: handle missing email field in config
docs: add TYPES.md with shared type definitions
refactor: extract provider interface from hunt command
test: add unit tests for job scoring
chore: configure ESLint and Prettier
```

**Guidelines:**
- Write in English
- Keep it concise — describe **why**, not **what**
- Use lowercase after the colon
- No period at the end

---

## Code Style

### Project structure rules

wolf uses a **layered architecture**. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full picture. The key rule:

```
src/cli/       → Thin wrapper. Parses args, calls commands, formats output.
src/mcp/       → Thin wrapper. Defines tool schemas, calls commands, returns JSON.
src/commands/  → ALL business logic lives here. Never import from cli/ or mcp/.
src/types/     → Shared TypeScript types. The contract between all layers.
src/utils/     → Shared helpers (config, db, logging).
```

**Do:**
- Put business logic in `src/commands/`
- Use types from `src/types/` — don't define ad-hoc types
- Return structured data from commands — never `console.log` inside a command

**Don't:**
- Put API calls or business logic in `src/cli/` or `src/mcp/`
- Import one command from another — commands communicate through SQLite

### TypeScript

- Strict mode is on (`strict: true` in `tsconfig.json`)
- Use explicit types for function parameters and return values
- Prefer `interface` over `type` for object shapes

### Linting & formatting

> **Status:** ESLint and Prettier will be configured when Milestone 1 is complete. For now, follow the patterns in existing code.

Once configured, run:

```bash
npm run lint        # check for issues
npm run lint:fix    # auto-fix issues
npm run format      # format with Prettier
```

---

## Documentation Rules

**Every markdown doc** (except `CLAUDE.md` and `README.md`) **must have a Chinese version** with a `_zh` suffix.

| English | Chinese |
|---|---|
| `docs/ARCHITECTURE.md` | `docs/ARCHITECTURE_zh.md` |
| `CONTRIBUTING.md` | `CONTRIBUTING_zh.md` |

**Both versions must be created or updated in the same commit.** If you change the English version, update the Chinese version too.

See [docs/PROJECT-DOCUMENTATION-STRUCTURE.md](docs/PROJECT-DOCUMENTATION-STRUCTURE.md) for the full doc layout.

---

## Testing

### Framework

We use **vitest** — a fast, TypeScript-native test runner.

```bash
npm run test             # run all tests
npm run test -- --watch  # re-run on file changes
```

### Test-Driven Development (TDD)

**Write the test before the code.** This is not optional.

1. Write a failing test that describes the expected behavior
2. Write the minimum code to make it pass
3. Refactor if needed — the test protects you

Example:

```typescript
// Write this FIRST:
it('should reject scores outside 0.0-1.0', async () => {
  mockClaude.returns({ score: 1.5 });
  await expect(hunt(options)).rejects.toThrow('Score out of range');
});

// THEN write the validation in hunt.ts
```

### AI feature testing

Any command that calls the Claude API **must** mock the API and validate the response structure. This prevents AI hallucinations from breaking things. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

---

## Using AI to Code (Vibe Coding)

Using AI tools to write code is **allowed and encouraged**. Claude Code, Cursor, ChatGPT — use whatever helps you move fast.

**One rule:** Before you commit AI-generated code, you **must** ask your AI to explain what the code does. Make sure you understand it. Even though we have tests, don't blindly commit AI output — it can introduce subtle junk that passes tests but makes the codebase worse.

---

## Finding Work

Not sure what to work on? Here's how to find tasks:

1. **Check the milestone checklist** — open [docs/MILESTONES.md](docs/MILESTONES.md) and look for unchecked items (`- [ ]`)
2. **Browse GitHub Issues** — pick one that interests you, or create a new one
3. **Ask the project owner** — if you're unsure what to pick, just ask

---

## Getting Help

When you're stuck:

1. **Ask your AI first** (strongly recommended) — paste the error message into Claude Code, ChatGPT, or whatever AI tool you use. Most development problems can be solved this way.
2. **CI/CD failing and you don't know why?** — copy the error output and ask your AI to explain it and suggest a fix.
3. **Still stuck?** — reach out to the project owner.

---

## Key Documents

| Document | What it tells you |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Project overview, tech stack, commands |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, layer responsibilities |
| [docs/TYPES.md](docs/TYPES.md) | All shared TypeScript types |
| [docs/MILESTONES.md](docs/MILESTONES.md) | Roadmap and task checklist |
| [docs/SCOPE.md](docs/SCOPE.md) | What wolf does and doesn't do |
