# Scope — wolf

## What is wolf

**wolf** (**W**orkflow of **O**utreaching, **L**inkedIn & **F**illing) is an AI-powered job hunting CLI and MCP server. It automates the repetitive parts of the job search pipeline — finding roles, tailoring resumes, filling application forms, and sending outreach emails — so you can focus on preparing for interviews and building skills.

wolf is a **personal automation tool**, not a platform or service. It runs on your machine, stores data locally, and calls external APIs only when you ask it to.

## Target Users

**CS students** looking for software engineering internships or full-time positions, who:

- Use **LinkedIn** and **Handshake** as primary job sources
- Are comfortable with the **terminal** (can run `npm install`, edit `.env` files)
- Want to apply to many roles efficiently without sacrificing quality
- May use AI agents (like OpenClaw) to orchestrate their job search workflow

## In Scope

### Job Discovery (`wolf hunt`)

Find job listings from multiple sources and save them locally.

- **LinkedIn** scraping via Apify
- **Handshake** scraping via Apify (best-effort; limited actor support)
- **Email alerts** parsing via Gmail API (job alert emails from LinkedIn, Handshake, etc.)
- **Browser-assisted** extraction via BrowserMCP (AI-driven page navigation)
- **Manual entry** — paste a JD or URL directly (`wolf hunt --manual`)

### Job Scoring (`wolf hunt`)

AI-powered relevance scoring using Claude API.

- Score each job 0.0–1.0 against user profile (skills, target roles, locations)
- Require a justification for each score (prevents AI hallucination)
- Filter by minimum score threshold from config

### Resume Tailoring (`wolf tailor`)

Rewrite resume bullet points to better match a specific JD.

- Parse resume from LaTeX (`.tex`) source
- AI rewrite via Claude API, preserving structure and truthfulness
- Output a new tailored `.tex` file + compile to PDF via `xelatex`
- Show diff and match score

### Cover Letter Generation (`wolf tailor --cover-letter`)

Generate a targeted cover letter for a specific job.

- AI-drafted via Claude API, based on JD + user profile + tailored resume
- Output as `.md` file + convert to PDF via `md-to-pdf`
- Tone and length configurable

### User Profile (`wolf init`)

Collect and store personal information needed for applications and outreach.

- **Immigration status** (e.g. US citizen, F-1 OPT, H-1B sponsorship needed)
- **Current city / willingness to relocate**
- **Work authorization timeline** (e.g. OPT start date, sponsorship requirement)
- **Target roles and locations**
- **Skills and experience summary**
- **Contact info** (name, email, phone, LinkedIn URL)
- Stored locally in `~/.wolf/config.json` — never uploaded unless you initiate an API call
- Used by `wolf file` (form filling), `wolf reach` (email drafting), and `wolf tailor` (resume context)

### Form Filling (`wolf file`)

Automate job application form submission using browser automation.

- Detect form fields on application pages (Playwright)
- Map user profile data to form fields
- Dry-run mode by default; explicit opt-in for live submission
- Screenshot capture for audit trail

### Outreach (`wolf reach`)

Find hiring contacts and send personalized cold emails.

- LinkedIn people search via Apify (recruiters, hiring managers)
- Email address inference (firstname.lastname@company.com patterns)
- AI-drafted personalized emails via Claude API
- Send via Gmail API with explicit `--send` flag + confirmation

### Job Tracking (`wolf status`)

Track application status locally.

- Status lifecycle: `new` → `reviewed` → `applied` / `rejected`
- Filter by status, score, date
- All data in local SQLite — inspectable, portable, no cloud dependency

### Dual Interface & External Orchestration

wolf provides both a CLI (commander.js) and an MCP server (MCP SDK), sharing the same core logic. It is designed to be **orchestrated, not to orchestrate** — external tools like OpenClaw, n8n, and LangGraph can drive wolf via CLI (`--json` output) or MCP tools. Architecture details and integration examples: [ARCHITECTURE.md § External Orchestration](ARCHITECTURE.md#external-orchestration-integration).

## Out of Scope

The following are explicitly **not** part of wolf's goals:

| Area | Why not |
|---|---|
| **Interview preparation** (mock interviews, behavioral prep, LeetCode practice) | Different problem domain; tools like Pramp, Interviewing.io, Neetcode already exist |
| **Salary negotiation** (offer comparison, negotiation scripts) | Requires domain expertise beyond job search automation |
| **ATS status tracking** (tracking application status inside employer ATS systems) | Would require per-employer integrations with no standard API; wolf tracks *your* status locally |
| **Networking / relationship management** (CRM for contacts, follow-up scheduling) | wolf finds contacts for outreach, but is not a CRM |
| **Portfolio / personal website generation** | Orthogonal to job applications; many dedicated tools exist |
| **Job posting aggregation service** | wolf is a personal tool, not a platform serving multiple users |
| **Interview scheduling** (calendar management, availability coordination) | Requires calendar integration and real-time coordination outside wolf's scope |

## Platform & Constraints

| Dimension | Detail |
|---|---|
| **Runtime** | Node.js (TypeScript) |
| **OS** | macOS and Linux; Windows support is not a priority |
| **Data storage** | Local SQLite database (`data/wolf.sqlite`); no cloud sync |
| **Network** | Internet required only for external API calls (Apify, Claude, Gmail); core tracking and status work offline |

