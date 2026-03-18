# wolf — Milestones

---

## Milestone 1 — Scaffolding & Skeleton
> wolf is runnable as both a CLI and an MCP server, all subcommands registered (stubs ok)

### Project setup
- [ ] Init TypeScript + Node.js project structure
- [ ] Define shared types (`Job`, `Resume`, `AppConfig`)
- [ ] `wolf init` — interactive setup wizard (resume path, target roles, locations)
- [ ] Config read/write (`~/.wolf/config.json`)
- [ ] `.env` handling for API keys (Apify, Claude, Gmail)

### CLI skeleton
- [ ] Set up `commander.js` CLI entry point (`wolf`)
- [ ] Register subcommands: `wolf hunt`, `wolf tailor`, `wolf file`, `wolf reach`, `wolf status` (stubs ok)

### MCP skeleton
- [ ] MCP server entry point (`wolf mcp serve`)
- [ ] Register MCP tools: `wolf_hunt`, `wolf_tailor`, `wolf_file`, `wolf_reach` (stubs ok)
- [ ] Typed input/output schemas defined for all 4 tools
- [ ] Verify connection from Claude Desktop / OpenClaw

---

## Milestone 2 — Hunter
> wolf can find and score jobs from LinkedIn and Handshake

### `wolf hunt` / `wolf_hunt`
- [ ] Apify LinkedIn scraper integration
- [ ] Handshake scraper integration
- [ ] Deduplicate results across sources
- [ ] Save raw JD results to local DB (SQLite or JSON file)
- [ ] Claude API — score JD relevance against user profile (0.0–1.0)
- [ ] Filter by `min_score` from config
- [ ] Tag jobs: `new` / `reviewed` / `applied` / `rejected`
- [ ] Wire up MCP tool (replace stub)

### `wolf status`
- [ ] List all tracked jobs with status and score
- [ ] Filter by `--status`, `--score`, `--date`

---

## Milestone 3 — Resume Tailor
> wolf can tailor your resume to a specific JD

### `wolf tailor` / `wolf_tailor`
- [ ] Parse resume from `.md` source file
- [ ] Claude API prompt — rewrite bullet points to match JD keywords
- [ ] Output tailored resume as new `.md` file
- [ ] Print match score and key changes summary
- [ ] `--diff` flag — show before/after comparison
- [ ] Wire up MCP tool (replace stub)

---

## Milestone 4 — Form Prefill
> wolf can auto-fill job application forms

### `wolf file` / `wolf_file`
- [ ] Playwright browser setup (headless + headed modes)
- [ ] Form field detection (name, email, resume upload, cover letter, etc.)
- [ ] Map user profile data to detected fields
- [ ] `wolf file --dry-run` — print detected fields without submitting
- [ ] `wolf file` — fill and submit live
- [ ] Screenshot on completion for audit trail
- [ ] Handle common edge cases (dropdowns, checkboxes, file uploads)
- [ ] Wire up MCP tool (replace stub)

---

## Milestone 5 — Outreach
> wolf can find HR contacts and draft cold emails

### `wolf reach` / `wolf_reach`
- [ ] LinkedIn people search via Apify (recruiter / hiring manager by company)
- [ ] Extract name, title, email where available
- [ ] Fallback: generate likely email format (`firstname.lastname@company.com`)
- [ ] Claude API prompt — draft personalized cold email (tone configurable)
- [ ] Output draft to `.md` file for review
- [ ] `--send` flag — send via Gmail API after user confirmation
- [ ] Gmail API integration (OAuth2, send on behalf of user)
- [ ] Wire up MCP tool (replace stub)
