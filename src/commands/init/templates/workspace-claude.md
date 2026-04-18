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

### Job lifecycle
| Command | What it does |
|---|---|
| `wolf add` | Add a job manually (title, company, JD text) - returns a `jobId` |
| `wolf hunt` | Auto-fetch job listings from online sources (requires Apify) |
| `wolf score` | Score pending jobs against the profile |
| `wolf status` | List all tracked jobs with status and scores |

### Tailor pipeline (3-agent flow with checkpoints)
| Command | What it does |
|---|---|
| `wolf tailor --job <id>` | Full pipeline: analyst brief -> resume + cover letter (parallel) |
| `wolf tailor brief --job <id>` | Step 1 only: produce the tailoring brief |
| `wolf tailor resume --job <id>` | Step 2a only: write resume (requires existing brief) |
| `wolf tailor cover --job <id>` | Step 2b only: write cover letter (requires existing brief) |

All tailor commands accept `--hint "<text>"` to give the analyst pre-analysis guidance.

### Apply & reach out
| Command | What it does |
|---|---|
| `wolf fill --job <id>` | Auto-fill a job application form (requires Playwright) |
| `wolf reach --job <id>` | Find hiring contacts and draft outreach emails |

### Config & profile management
| Command | What it does |
|---|---|
| `wolf config get/set <key> [value]` | Read or edit `wolf.toml` fields by dot-path (e.g. `tailor.model`) |
| `wolf profile get/set <key> [value]` | Read or edit the default profile's fields |
| `wolf profile list` | List all profiles (default marked with `*`) |
| `wolf profile create <id> [--from <src>]` | Create a new profile (clones default unless --from given) |
| `wolf profile use <id>` | Switch the default profile |
| `wolf profile delete <id> --yes` | Delete a profile directory |
| `wolf env show / set / clear` | Manage `WOLF_*` API keys in shell |

## Typical workflow

### One-shot (trust the AI)
```
wolf add --title "SWE" --company "Acme" --jd-text "..."   # returns jobId
wolf tailor --job <jobId>                                 # full 3-agent pipeline
```

### Iterative (human-in-the-loop)
```
wolf tailor brief --job <jobId> --hint "focus on ML ops"  # steer the analyst
# inspect and optionally edit data/jobs/<...>/src/tailoring-brief.md
wolf tailor resume --job <jobId>                          # write resume using the brief
wolf tailor cover --job <jobId>                           # write cover letter using the brief
# not happy? edit brief and re-run resume/cover; no need to re-analyze
```

## Data layout

All generated artifacts live under `data/`, grouped by entity:

```
data/
├── wolf.sqlite                           ← metadata only (no prose)
├── jobs/
│   └── <company>_<title>_<jobIdShort>/   ← one dir per job
│       ├── jd.md                         ← job description (source of truth)
│       ├── src/
│       │   ├── hint.md                   ← you/your agent edit to steer the analyst
│       │   ├── tailoring-brief.md        ← analyst output; edit to adjust
│       │   ├── resume.html               ← resume source (hand-tune if needed)
│       │   └── cover_letter.html         ← cover letter source
│       ├── resume.pdf                    ← final PDF
│       └── cover_letter.pdf              ← final PDF
└── companies/
    └── <company>_<companyIdShort>/
        └── info.md                       ← free-form notes about the employer
```

**Prose lives on disk, not in SQLite.** `jd.md` and `info.md` are greppable
from the shell and editable with any text editor. SQLite keeps only the
structured fields (id, title, score, status, etc.) that need indexing.

**All `.md` and `.html` files under `src/` are editable checkpoints.** If the
resume is off but the cover letter is fine, edit `tailoring-brief.md` (or
`resume.html` directly) and re-run just `wolf tailor resume`. The analyst does
not re-run unless you call `wolf tailor brief` again.

### hint.md / info.md convention

`hint.md` is created the first time you run any tailor step for a job;
`info.md` is created when a company is first recorded. Lines starting with `//`
are stripped before AI sees the file (same rule as `resume_pool.md`), so the
header is self-documenting but ignored. Write guidance/notes as plain Markdown
**below** the `//` header.

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
