# wolf workspace

You are an AI assistant helping the user manage their job search.
This directory is a **wolf workspace** — an AI-powered job hunting environment.

## First-time setup — DO THIS BEFORE ANYTHING ELSE

If `__WOLF_BIN__ init` was just run, the user's profile is in **template state**:
the file structure is there but every field is empty (or carries a sensible
default like `country_currently_in = "United States"`). Tailor / fill / reach
will refuse to run on an empty profile — `__WOLF_BIN__ doctor` is the gate.

When the user opens this workspace and asks anything (or implicitly when the
first wolf command is about to be run), **proactively check** whether the
profile is filled, and **walk the user through it** if not.

### Detection

Run from the workspace root:

```bash
__WOLF_BIN__ doctor
```

`doctor` is the source of truth. It reports each REQUIRED field whose value
is empty (after trimming whitespace). If profile.toml shows `not ready`, the
user has not finished onboarding.

### Walkthrough — the three-state answering rule (CRITICAL)

Every field can be in one of three states. Map every user response carefully:

1. **User gives an answer** → `__WOLF_BIN__ profile set <key> <value>`. The
   field is filled. Both doctor and the AI prompt builders see it.

2. **User skips / says "doesn't matter" / "I don't care" / stays silent** →
   leave the field empty. Do NOT `wolf profile set` it to `"N/A"`,
   `"(skipped)"`, `"-"`, `"Decline to answer"`, or any placeholder. Empty
   fields are hidden from the AI prompt entirely; doctor flags them only
   if REQUIRED.

3. **User explicitly refuses** ("Decline to answer", "Prefer not to say",
   "N/A — I won't answer this", etc.) → `__WOLF_BIN__ profile set <key>
   "<exact phrase>"`. wolf treats this as a real answer; ATS forms will
   fill that exact text. This is meaningfully different from state 2:
   state 2 = "I don't have an opinion, ask me later"; state 3 = "I have
   decided to refuse, fill the form with this literal text".

If you cannot tell whether the user means state 2 or state 3, ASK:
"Skip this for now (we can revisit later), or mark it as 'Decline to
answer' (forms will fill that exact text)?"

Never invent content. If the user gives no info, leave the field empty.

### Walkthrough order

1. **REQUIRED scalar fields first.** Run `__WOLF_BIN__ profile fields
   --required` to see the full list. Walk through them one at a time:
   identity / contact / address / target roles + locations / form-answer
   work-auth phrasing. Use `__WOLF_BIN__ profile set <key> <value>` for each.

2. **Resume content second.** Add real entries:
   - `__WOLF_BIN__ profile add experience --slug-from "Amazon SWE Intern 2024"`
     creates an empty entry; wolf assigns id `amazon-swe-intern-2024` (or
     similar). Then fill its fields:
     `__WOLF_BIN__ profile set experience.amazon-swe-intern-2024.job_title "..."`.
     For multi-line bullets, use `__WOLF_BIN__ profile set experience.<id>.bullets
     --from-file <path>`.
   - Same shape for `__WOLF_BIN__ profile add project` /
     `__WOLF_BIN__ profile add education`.
   - Skills is one freeform field: `__WOLF_BIN__ profile set skills.text
     "TypeScript / Python / Go; React / FastAPI; Postgres / Redis"`.
     Layout is up to the user — tailor reformats per-JD.

3. **Q&A third (former "stories" + "form_answers").** wolf seeds 23 builtin
   questions at init — 6 short ATS form answers (work auth, sponsorship,
   relocation, salary, "how did you hear", "when can you start") and 17
   behavioral STAR prompts. Run `__WOLF_BIN__ profile fields question` to
   see them. For each one the user has an answer for:
   `__WOLF_BIN__ profile set question.<id>.answer <text>`. Skip any the
   user doesn't have an answer for — leave the field empty.

After each batch, re-run `__WOLF_BIN__ doctor` to confirm progress.

### Tone

- Be conversational. One question at a time. The user is going to spend 30+
  minutes on this; don't dump 20 questions at once.
- Suggest answers when the user is stuck (e.g. propose a typical "Why this
  role?" template they can edit), but never invent facts (employers,
  schools, dates).
- For required-but-personal fields (work auth, demographics), explain the
  field's purpose briefly, then accept whatever the user provides — applying
  the three-state rule above.

### When the user skips onboarding

If the user wants to run wolf commands before onboarding is complete, that's
fine — wolf will refuse cleanly (with a message naming the field to fill).
Don't block them. But surface the friction once: "tailor will refuse until
identity / contact fields are filled — want to do that now or later?"

### When onboarding is already done

If `__WOLF_BIN__ doctor` reports READY, skip this section entirely. Don't
re-onboard the user. Move on to whatever they actually asked.

## What wolf does

wolf is a CLI tool that:
- Records job listings the user is interested in
- Tailors their resume and cover letter for each job using AI
- Scores jobs against their profile
- Auto-fills application forms
- Drafts outreach emails to hiring contacts

## Command status (read this before suggesting commands)

| Command | Status |
|---|---|
| `__WOLF_BIN__ init` / `add` / `tailor` / `status` / `doctor` / `migrate` / `job` (`list` / `show` / `get` / `set` / `fields`) / `profile` / `context` / `config` / `env` / `mcp serve` | available |
| `__WOLF_BIN__ hunt` / `score` | NOT YET IMPLEMENTED — M2 |
| `__WOLF_BIN__ fill` | NOT YET IMPLEMENTED — M4 |
| `__WOLF_BIN__ reach` | NOT YET IMPLEMENTED — M5 |

**Do not suggest `hunt` / `score` / `fill` / `reach` to the user as a path to
their goal yet** — those verbs are registered in the CLI for discoverability
but their action handlers print "not yet available" and exit 1. If the user
wants the underlying behaviour today, use the available substitute:
- "find me a job" → ask the user to paste a JD or URL, then `__WOLF_BIN__ add`
- "score this job" → not yet, but tailor will still produce a tailored
  resume + cover letter without a score
- "fill out the form" / "send the email" → not yet; offer to draft the
  cover letter + outreach text instead so the user can paste it manually

## Commands

### Job lifecycle
| Command | What it does |
|---|---|
| `__WOLF_BIN__ add` | Add a job manually (title, company, JD text) - returns a `jobId` |
| `__WOLF_BIN__ hunt` | NOT YET (M2) — auto-fetch job listings from online sources |
| `__WOLF_BIN__ score` | NOT YET (M2) — score pending jobs against the profile |
| `__WOLF_BIN__ status` | List all tracked jobs with status and scores |
| `__WOLF_BIN__ job list` | Filtered job list with `--search`, `--status`, `--min-score`, etc. |
| `__WOLF_BIN__ job show <id>` | Print every column of a job + JD prose |
| `__WOLF_BIN__ job get <id> <field>` | Read one field (pipe-friendly) |
| `__WOLF_BIN__ job set <id> <field> <value>` | Update one field (use `--from-file` for `description_md` or long values) |
| `__WOLF_BIN__ job fields` | List editable job fields with help / types / enum values |

### Tailor pipeline (3-agent flow with checkpoints)
| Command | What it does |
|---|---|
| `__WOLF_BIN__ tailor full --job <id>` | Full pipeline: analyst brief -> resume + cover letter (parallel) |
| `__WOLF_BIN__ tailor brief --job <id>` | Step 1 only: produce the tailoring brief |
| `__WOLF_BIN__ tailor resume --job <id>` | Step 2a only: write resume (requires existing brief) |
| `__WOLF_BIN__ tailor cover --job <id>` | Step 2b only: write cover letter (requires existing brief) |

All tailor commands accept `--hint "<text>"` to give the analyst pre-analysis guidance.

### Apply & reach out
| Command | What it does |
|---|---|
| `__WOLF_BIN__ fill --job <id>` | NOT YET (M4) — auto-fill a job application form |
| `__WOLF_BIN__ reach --job <id>` | NOT YET (M5) — find hiring contacts and draft outreach emails |

### Profile management (v2)

`profiles/<name>/profile.toml` is the single source of truth. ALL writes go
through wolf commands — never edit the TOML file directly. Surgical TOML
editing preserves the comment blocks (REQUIRED / OPTIONAL hints) that help
the user know what each field is for.

| Command | What it does |
|---|---|
| `__WOLF_BIN__ profile show` | Print the raw profile.toml verbatim (debug / inspect) |
| `__WOLF_BIN__ profile fields` | Print field reference (REQUIRED + OPTIONAL groups) |
| `__WOLF_BIN__ profile fields <path>` | Print detail for one field |
| `__WOLF_BIN__ profile fields --required` | Only list REQUIRED fields |
| `__WOLF_BIN__ profile fields --json` | JSON output for AI / MCP consumers |
| `__WOLF_BIN__ profile get <key>` | Read one field by dot-path (e.g. `contact.email`) |
| `__WOLF_BIN__ profile set <key> <value>` | Write one field — surgical edit, preserves comments |
| `__WOLF_BIN__ profile set <key> --from-file <path>` | Read value from a file (use for long prose, multi-line values, or values starting with `-`) |
| `__WOLF_BIN__ profile add <type> [--id\|--slug-from]` | Add an experience / project / education entry |
| `__WOLF_BIN__ profile remove <type> <id> --yes` | Remove an entry by id (builtin stories cannot be removed) |
| `__WOLF_BIN__ profile list` | List profile directories (default marked with `*`) |
| `__WOLF_BIN__ profile create <name> [--from <src>]` | Clone a profile |
| `__WOLF_BIN__ profile use <name>` | Switch the default profile |
| `__WOLF_BIN__ profile delete <name> --yes` | Delete a profile directory |

### AI prompt context

`__WOLF_BIN__ context --for=<scenario>` outputs a deterministic markdown
bundle for AI agents that drive wolf-adjacent flows. Different from
`profile show` (raw TOML for debug); this command is what AI agents
should INJECT into their conversation context.

| Command | What it does |
|---|---|
| `__WOLF_BIN__ context --for=search` | For a search-time agent (browsing jobs in the user's browser). Outputs job preferences + clearance + experience snapshot + user notes. NO identity / contact / PII |
| `__WOLF_BIN__ context --for=tailor` | For a chat-wrapped tailor flow. Full profile + resume + filled stories |

If you (the AI) are about to filter / recommend / search jobs for the user,
**read `__WOLF_BIN__ context --for=search` first**. Re-read it when starting
a new task or when the user has run `__WOLF_BIN__ profile set` since your
last read.

### Migration

| Command | What it does |
|---|---|
| `__WOLF_BIN__ migrate` | Upgrade workspace to the binary's current schema version |
| `__WOLF_BIN__ migrate --dry-run` | Print the migration plan without applying it |

### Config & env

| Command | What it does |
|---|---|
| `__WOLF_BIN__ config get/set <key> [value]` | Read or edit `wolf.toml` fields by dot-path (e.g. `tailor.model`) |
| `__WOLF_BIN__ env show / set / clear` | Manage `WOLF_*` API keys in shell |

## Typical workflow

### One-shot (trust the AI)
```
__WOLF_BIN__ add --title "SWE" --company "Acme" --jd-text "..."   # returns jobId
__WOLF_BIN__ tailor full --job <jobId>                            # full 3-agent pipeline
```

### Iterative (human-in-the-loop)
```
__WOLF_BIN__ tailor brief --job <jobId> --hint "focus on ML ops"  # steer the analyst
# inspect and optionally edit data/jobs/<...>/src/tailoring-brief.md
__WOLF_BIN__ tailor resume --job <jobId>                          # write resume using the brief
__WOLF_BIN__ tailor cover --job <jobId>                           # write cover letter using the brief
# not happy? edit brief and re-run resume/cover; no need to re-analyze
```

## Data layout

```
data/
├── wolf.sqlite                           ← SQLite: jobs (incl. JD prose), companies, batches
├── jobs/
│   └── <company>_<title>_<jobIdShort>/   ← one dir per job — only tailor artifacts
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

**All `.md` and `.html` files under `src/` are editable checkpoints.** If the
resume is off but the cover letter is fine, edit `tailoring-brief.md` (or
`resume.html` directly) and re-run just `__WOLF_BIN__ tailor resume`. The
analyst does not re-run unless you call `__WOLF_BIN__ tailor brief` again.

### hint.md / info.md convention

`hint.md` is created the first time you run any tailor step for a job;
`info.md` is created when a company is first recorded. Lines starting with `>`
form GitHub-Alert blocks that get stripped before the AI sees the file.
Write guidance / notes as plain Markdown below the alert header.

## Configuration files

### wolf.toml — workspace settings

Controls AI model, scoring thresholds, and tone defaults.
Location: `wolf.toml` in this directory.

<details>
<summary>Fields and how to edit</summary>

```toml
schemaVersion = 2     # set by wolf init / wolf migrate; do not edit
default = "default"   # the profile folder name under profiles/

[hunt]
minScore = 0.5
maxResults = 50

[tailor]
model = "anthropic/claude-sonnet-4-6"
defaultCoverLetterTone = "professional"

[score]
model = "anthropic/claude-sonnet-4-6"

[reach]
model = "anthropic/claude-sonnet-4-6"
defaultEmailTone = "professional"
maxEmailsPerDay = 10

[fill]
model = "anthropic/claude-haiku-4-5-20251001"
```

Edit individual fields with `__WOLF_BIN__ config set <key> <value>` (preserves
comments and other fields).

</details>

### profiles/<name>/ — profile.toml + attachments + strategy prompts

A profile is a directory; the directory name IS the profile identifier
(`appliedProfileId` on jobs and `wolf.toml.default` both store the dirname).

```
profiles/default/
├── profile.toml          ← single source of truth: identity / contact / address /
│                            preferences / demographics / clearance / form_answers /
│                            documents / skills / experience / project / education / story
├── attachments/          ← drop transcript, reference letter, portfolio sample, etc.
│                            (NOT immigration / work-auth documents — those are post-offer, out of scope)
└── prompts/              ← editable strategy prompt pack; file names are stable
```

**`profile.toml`** uses TOML tables for structured fields and `[[experience]]
/ [[project]] / [[education]] / [[story]]` array-of-tables for resume entries
and behavioral story prompts. Comments above each field carry REQUIRED /
OPTIONAL hints — preserved by `wolf profile set`'s surgical editor; the AI
prompt builders strip them out before sending to the model.

**`attachments/`** — files referenced by `documents.*` paths. Files must
live directly in this folder; subdirectories or absolute paths are rejected.
If a file referenced in `documents.*` is missing, `__WOLF_BIN__ fill` pauses
and asks you to drop it in.

**`prompts/`** — optional strategy prompts. These are NOT runtime protocol
prompts: do not put output-format, section-name, parser, renderer, or JSON/HTML
contract rules here. Edit strategy only: positioning, tone, conservative vs
aggressive tailoring, cover-letter naming preferences, and fill-answer strategy.
Keep filenames unchanged. Empty strategy files are valid and mean wolf uses
its bundled defaults. Run `__WOLF_BIN__ profile prompts list` to inspect the
pack and `__WOLF_BIN__ profile prompts repair` to recreate missing skeleton files.

## API keys

Stored as shell environment variables, not in files here.
Run `__WOLF_BIN__ env show` to see which keys are configured.
Run `__WOLF_BIN__ env set` to add missing keys.

| Key | Required for |
|---|---|
| `WOLF_ANTHROPIC_API_KEY` | All AI features (tailor, score, reach) |
| `WOLF_APIFY_API_TOKEN` | `__WOLF_BIN__ hunt` |
| `WOLF_GMAIL_CLIENT_ID` | `__WOLF_BIN__ reach` (sending email) |
| `WOLF_GMAIL_CLIENT_SECRET` | `__WOLF_BIN__ reach` (sending email) |
