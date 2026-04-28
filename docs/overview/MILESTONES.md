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
- [x] Register subcommands: `wolf hunt`, `wolf score`, `wolf list`, `wolf select`, `wolf tailor`, `wolf cover-letter`, `wolf fill`, `wolf reach`, `wolf env` (stubs ok)

### MCP skeleton
- [x] MCP server entry point (`wolf mcp serve`)
- [x] Register MCP tools: `wolf_hunt`, `wolf_add`, `wolf_score`, `wolf_list`, `wolf_select`, `wolf_tailor`, `wolf_cover_letter`, `wolf_fill`, `wolf_reach`, `wolf_status` (stubs ok)
- [x] Typed input/output schemas defined for all tools
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

### `wolf_add` (MCP only)
- [ ] Accept structured job data `{ title, company, jdText, url? }` from AI orchestrator
- [ ] Store job in DB with `status: raw`, `score: null`; return `jobId`
- [ ] No CLI equivalent — AI caller (Claude/OpenClaw) is responsible for extracting structure from user input (screenshot, pasted text, URL)

### `wolf score` / `wolf_score`
- [ ] Read unscored jobs (`score: null` OR `status: score_error`) from DB
- [ ] AI field extraction — Claude API extracts structured fields (sponsorship, tech stack, remote, salary) from raw JD text
- [ ] Apply dealbreakers (hard filters) — disqualified jobs saved as `status: filtered`
- [ ] Claude API (Batch) — async scoring of remaining jobs against user profile (0.0–1.0)
- [ ] Hybrid scoring: algorithm scores structured dimensions (location, salary, work auth); Claude scores `roleMatch` only
- [ ] `--jobid` flag — skip Batch API, score one job synchronously via Haiku (for AI-orchestrated flows after `wolf_add`)
- [ ] Wire up MCP tool (replace stub)

### `wolf list` / `wolf_list`
- [ ] `--jobs` mode: filter by score, status, date, company; return table sorted by score
- [ ] `--companies` mode: return all distinct companies with IDs
- [ ] Wire up MCP tool (replace stub)

### `wolf select` / `wolf_select`
- [ ] Interactive TUI (CLI): browse scored jobs, toggle `selected` field
- [ ] MCP: accept `{ jobIds, action: "select" | "unselect" }`, update DB
- [ ] Wire up MCP tool (replace stub)

---

## Milestone 3 — Resume Tailor
> wolf can tailor your resume to a specific JD

### `wolf tailor` / `wolf_tailor`
- [x] Read resume bullets from `resume_pool.md` and personal data from `profile.md`
- [x] 3-agent checkpoint pipeline: analyst writes `tailoring-brief.md`; resume + cover letter writers run in parallel
- [x] Claude API prompts — rewrite bullet points and cover letter HTML to match JD
- [x] Output tailored resume as `resume.html` + render to PDF via Playwright Chromium with deterministic fit-loop (binary search over `--font-size` / `--line-height` / `--margin-in`)
- [x] `--no-cover-letter` flag — skip cover letter writer; `--hint` flag — pass guidance into the analyst via `hint.md`
- [x] Print final fit parameters and artifact paths
- [x] `--diff` flag — show before/after comparison
- [x] Wire up MCP tool (replace stub)

### `wolf cover-letter` / `wolf_cover_letter`
- [x] Generate cover letter as part of the tailor pipeline (parallel branch 2b)
- [x] Check JD / companies table for company description; omit "why this company" section if not found
- [x] Save as `cover_letter.html` + render to PDF via Playwright Chromium (natural CSS layout, multi-page allowed); record path on the Job row
- [x] Wire up MCP tool (replace stub)

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
