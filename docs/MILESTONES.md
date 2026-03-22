# wolf — Milestones

---

## Milestone 1 — Scaffolding & Skeleton
> wolf is runnable as both a CLI and an MCP server, all subcommands registered (stubs ok)

### Project setup
- [x] Init TypeScript + Node.js project structure
- [x] Define shared types (`Job`, `Resume`, `AppConfig`)
- [x] `wolf init` — interactive setup wizard (resume path, target roles, locations)
- [x] Config read/write (`wolf.toml` in workspace root via `wolf init`)
- [x] API keys stored as `WOLF_*` shell environment variables; `wolf env set/show/clear` for management

### CLI skeleton
- [x] Set up `commander.js` CLI entry point (`wolf`)
- [x] Register subcommands: `wolf hunt`, `wolf score`, `wolf tailor`, `wolf fill`, `wolf reach`, `wolf status` (stubs ok)

### MCP skeleton
- [x] MCP server entry point (`wolf mcp serve`)
- [x] Register MCP tools: `wolf_hunt`, `wolf_score`, `wolf_tailor`, `wolf_fill`, `wolf_reach` (stubs ok)
- [x] Typed input/output schemas defined for all 5 tools
- [x] Verify connection from Claude Desktop / OpenClaw

---

## Milestone 2 — Hunter
> wolf can ingest and score job listings from any configured source

### `wolf hunt` / `wolf_hunt`
- [ ] Pluggable provider system — ingest jobs from any source via `JobProvider` interface
- [ ] `ApiProvider` — generic HTTP provider; fetches from any user-configured API endpoint
- [ ] Deduplicate results across providers
- [ ] Save raw jobs to local DB (SQLite) with `status: raw`, `score: null`
- [ ] Wire up MCP tool (replace stub)

### `wolf score` / `wolf_score`
- [ ] Read unscored jobs (`score: null`) from DB
- [ ] AI field extraction — Claude API extracts structured fields (sponsorship, tech stack, remote, salary) from raw JD text
- [ ] Apply dealbreakers (hard filters) — disqualified jobs saved as `status: filtered`
- [ ] Claude API (Batch) — async scoring of remaining jobs against user profile (0.0–1.0)
- [ ] Hybrid scoring: algorithm scores structured dimensions (location, salary, work auth); Claude scores `roleMatch` only
- [ ] Filter by `min_score` from config; tag jobs `new` / `reviewed` / `applied` / `rejected`
- [ ] Wire up MCP tool (replace stub)

### `wolf status`
- [ ] List all tracked jobs with status and score
- [ ] Filter by `--status`, `--score`, `--date`

---

## Milestone 3 — Resume Tailor
> wolf can tailor your resume to a specific JD

### `wolf tailor` / `wolf_tailor`
- [ ] Parse resume from `.tex` source file
- [ ] Claude API prompt — rewrite bullet points to match JD keywords
- [ ] Output tailored resume as new `.tex` file + compile to PDF via `xelatex`
- [ ] Generate cover letter as `.md` file + convert to PDF via `md-to-pdf`
- [ ] Print match score and key changes summary
- [ ] `--diff` flag — show before/after comparison
- [ ] Wire up MCP tool (replace stub)

---

## Milestone 4 — Form Prefill
> wolf can auto-fill job application forms

### `wolf fill` / `wolf_fill`
- [ ] Playwright browser setup (headless + headed modes)
- [ ] Form field detection (name, email, resume upload, cover letter, etc.)
- [ ] Map user profile data to detected fields
- [ ] `wolf fill --dry-run` — print detected fields without submitting
- [ ] `wolf fill` — fill and submit live
- [ ] Screenshot on completion for audit trail
- [ ] Handle common edge cases (dropdowns, checkboxes, file uploads)
- [ ] Wire up MCP tool (replace stub)

---

## Milestone 5 — Outreach
> wolf can find HR contacts and draft cold emails

### `wolf reach` / `wolf_reach`
- [ ] Find HR contacts (recruiter / hiring manager by company)
- [ ] Extract name, title, email where available
- [ ] Fallback: generate likely email format (`firstname.lastname@company.com`)
- [ ] Claude API prompt — draft personalized cold email (tone configurable)
- [ ] Output draft to `.md` file for review
- [ ] `--send` flag — send via Gmail API after user confirmation
- [ ] Gmail API integration (OAuth2, send on behalf of user)
- [ ] Wire up MCP tool (replace stub)
