# wolf workspace

You are an AI assistant helping the user manage their job search.
This directory is a **wolf workspace** — an AI-powered job hunting environment.

## What wolf does

wolf is a CLI tool that:
- Records job listings the user is interested in
- Tailors their resume and cover letter for each job using AI
- Scores jobs against their profile
- Auto-fills application forms
- Drafts outreach emails to hiring contacts

## Commands

| Command | What it does |
|---|---|
| `wolf add` | Add a job manually (title, company, JD text) — returns a `jobId` |
| `wolf tailor --job <jobId>` | AI-rewrite resume + generate cover letter for a job |
| `wolf score` | Score pending jobs against the profile |
| `wolf status` | List all tracked jobs with status and scores |
| `wolf hunt` | Auto-fetch job listings from online sources (requires Apify) |
| `wolf fill --job <jobId>` | Auto-fill a job application form (requires Playwright) |
| `wolf reach --job <jobId>` | Find hiring contacts and draft outreach emails |
| `wolf env show` | Show which WOLF_* API keys are configured |
| `wolf env set` | Interactively configure API keys in shell |

## Typical workflow

```
wolf add --title "SWE" --company "Acme" --jd-text "..."   # returns jobId
wolf tailor --job <jobId>                                   # resume.pdf + cover_letter.pdf
wolf fill --job <jobId>                                     # optional: auto-fill form
wolf reach --job <jobId>                                    # optional: outreach email
```

Output lands in `data/<jobId>/`:
- `resume.pdf` — tailored resume
- `cover_letter.pdf` — tailored cover letter

## Configuration files

### wolf.toml — workspace settings

Controls AI model, scoring thresholds, and tone defaults.
Location: `wolf.toml` in this directory.

<details>
<summary>Fields and how to edit</summary>

Open `wolf.toml` with any text editor and save.

```toml
defaultProfileId = "default"

# Each AI-using command has its own model.
# Format: "<provider>/<model>" where provider is "anthropic" or "openai".

[hunt]
minScore = 0.5                  # 0.0-1.0 - jobs below this are filtered
maxResults = 50                 # max jobs fetched per hunt run
# no model - wolf hunt does not call AI

[tailor]
model = "anthropic/claude-sonnet-4-6"
defaultCoverLetterTone = "professional"

[score]
model = "anthropic/claude-sonnet-4-6"

[reach]
model = "anthropic/claude-sonnet-4-6"
defaultEmailTone = "professional"
maxEmailsPerDay = 10            # safety cap

[fill]
model = "anthropic/claude-haiku-4-5-20251001"   # cheaper/faster for form filling
```

</details>

### profiles/default/profile.toml — identity and job preferences

Contains name, contact info, immigration status, target roles and locations.
wolf uses this to personalise resume tailoring and job scoring.
Location: `profiles/default/profile.toml`.

<details>
<summary>Fields and how to edit</summary>

Open `profiles/default/profile.toml` with any text editor and save.

```toml
id = "default"
label = "Default"
name = "Your Name"
email = "you@example.com"
phone = "+1 555 000 0000"
firstUrl = "https://linkedin.com/in/you"   # null if not set
secondUrl = "https://github.com/you"       # null if not set
thirdUrl = null                            # personal website, null if not set
immigrationStatus = "no limit"             # H-1B | L1 | OPT | CPT | no limit
willingToRelocate = "no"           # "no" | "yes" | "domestic only" | "open to relocation"
targetRoles = ["Software Engineer"]
targetLocations = ["Remote", "NYC"]
scoringNotes = null   # optional free-form hints to the AI scorer
```

</details>

### profiles/default/resume_pool.md — full experience bank

**The most important file to keep up to date.**

wolf reads this when tailoring resumes. Include everything — all past roles,
projects, skills, and education. wolf selects the most relevant content per job.
Location: `profiles/default/resume_pool.md`. Edit in any Markdown editor.

## API keys

Stored as shell environment variables, not in files here.
Run `wolf env show` to see which keys are configured.
Run `wolf env set` to add missing keys.

| Key | Required for |
|---|---|
| `WOLF_ANTHROPIC_API_KEY` | All AI features (tailor, score, reach) |
| `WOLF_APIFY_API_TOKEN` | `wolf hunt` |
| `WOLF_GMAIL_CLIENT_ID` | `wolf reach` (sending email) |
| `WOLF_GMAIL_CLIENT_SECRET` | `wolf reach` (sending email) |
