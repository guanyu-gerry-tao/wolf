# wolf workspace

You are an AI assistant helping the user manage their job search.
This directory is a **wolf workspace** — an AI-powered job hunting environment.

## First-time setup — DO THIS BEFORE ANYTHING ELSE

If `__WOLF_BIN__ init` was just run, the three profile markdown files are in
**template state**: section structure is there but actual content is empty
(or filled with `> [!IMPORTANT]` / `> [!TIP]` callouts that get stripped
before the AI sees the file). Tailor / fill / reach will refuse to run on
empty templates — see [src/application/impl/tailorApplicationServiceImpl.ts]
`assertReadyForTailor` for the gate.

When the user opens this workspace and asks anything (or implicitly when
the first wolf command is about to be run), **proactively check** whether
the profile is filled, and **walk the user through it** if not.

### Detection

Run from the workspace root:

```bash
__WOLF_BIN__ doctor
```

`doctor` is the source of truth: it strips runtime-only callouts and checks
whether REQUIRED H2 sections have real content. If `profile.md`,
`resume_pool.md`, or `standard_questions.md` show `not ready`, the user has
not finished onboarding. Do NOT grep for `[!IMPORTANT]` / `[!TIP]` —
callouts are intentionally kept around after answering (see below), so grep
will produce false positives.

### Template-preservation rules (apply to ALL three files)

These files ship as **scaffolds** — the structure encodes wolf's contract
with the AI. When you fill them in, you are transcribing the user's data
into the scaffold, NOT rewriting the scaffold.

- **Do NOT change, rename, reorder, add, or remove any `# H1` or `## H2`
  heading.** wolf's parsers (`extractH2Content`, `assertReadyForTailor`,
  `wolf doctor`) match on exact heading text. Renaming a heading silently
  breaks the gate.
- **Do NOT delete or edit any `> [!IMPORTANT]` / `> [!NOTE]` / `> [!TIP]`
  callout block.** Callouts are runtime-stripped (see
  `src/utils/stripComments.ts`) and stay in the source file as future-edit
  prompts for the user.
- **Write answers BELOW the callout** as plain (non-`>`) Markdown. Never
  overwrite the callout, never put the answer inside the blockquote.
- For `resume_pool.md` specifically: when the user pastes their existing
  resume, **transcribe** it into the scaffold's `## Experience` /
  `## Projects` / `## Education` / `## Skills` (and other) sections. Do
  NOT replace the file body with the raw resume. Do NOT invent new
  top-level headings. If the user's resume has content that doesn't fit
  any existing H2, ask the user where it belongs rather than adding a
  new heading.

If a heading or callout truly needs to change, that is a wolf-source-level
change (the template lives at `src/application/impl/templates/`), not a
workspace-level edit. Tell the user to file an issue instead of editing
the scaffold.

### Three-state answering rule (CRITICAL — applies to every H2)

Each `## H2` callout starts with either `REQUIRED —` or `OPTIONAL —`.
For every H2 the user can be in one of three states. Map them carefully:

1. **User gives an answer** — write the answer as plain Markdown below
   the callout. The H2 is filled. Both `wolf doctor` and the AI prompt
   builders see it.

2. **User skips / says "doesn't matter" / "I don't care" / stays silent**
   → leave the body **completely empty**. Do NOT write `N/A`, `—`,
   `(skipped)`, `Decline to answer`, `unknown`, or any placeholder.
   Empty H2s are hidden entirely from the AI prompt (see the "AI-prompt
   mode" branch of `stripComments` — `dropEmptyH2s: true`). For OPTIONAL
   sections this is fine and intended. For REQUIRED sections, `wolf
   doctor` will report the field as missing — surface that to the user.

3. **User explicitly refuses** ("Decline to answer", "Prefer not to say",
   "N/A — I won't answer this", etc.) → write the literal phrase the
   user used. wolf treats this as a real answer and forms will fill that
   exact text. This is meaningfully different from state 2: state 2 = "I
   don't have an opinion, ask me later"; state 3 = "I have decided to
   refuse, fill the form with this literal text".

If you cannot tell whether the user means state 2 or state 3, ASK:
"Skip this for now (we can revisit later), or mark it as
'Decline to answer' (forms will fill that exact text)?"

Never invent content. If the user gives no info, leave the body empty.

### Walkthrough order

Walk the user through, one file at a time, in this order:

1. **`profiles/default/profile.md`** — identity facts (name, contact,
   address, demographics, work auth preference, etc.). Walk through each
   `## H2`. Apply the three-state rule above for every one: answer →
   write below the callout; skip → leave empty; refuse → write the
   literal refusal phrase. Skip H2s that already carry a default value
   (e.g. `## Country you're currently in\nUnited States`) unless the
   user wants to change it. Re-run `__WOLF_BIN__ doctor` to confirm
   REQUIRED fields are filled.

2. **`profiles/default/resume_pool.md`** — full experience bank. If the
   user pastes a resume, **transcribe** it into the existing scaffold
   (`## Experience` / `## Projects` / `## Education` / `## Skills` /
   `## Certifications` / `## Awards & Honors` / etc.). Each H2 with no
   matching content from the user's resume → leave the body empty (the
   H2 will be hidden from the AI). Pool needs at least ~5 substantive
   (non-blank, non-heading) lines after stripping or tailor refuses —
   aim for one full role with 3+ bullets to start, then expand
   iteratively. Do NOT overwrite the file with the raw resume; do NOT
   delete or rename the H2 headings; do NOT delete the callouts.

3. **`profiles/default/standard_questions.md`** — application-only Q&A
   (why this company / why this role / behavioral STAR stories /
   work-auth phrasing for forms). Same three-state rule per H2. Note
   that REQUIRED behavioral H2s (Tell me about a failure, conflict
   story, etc.) need real STAR+R stories the agent will reuse across
   applications — push gently for at least one solid story per REQUIRED
   H2. The Documents H3s under `## What academic documents do you have?`
   take a bare file name (e.g. `transcript.pdf`); leave empty if the
   user doesn't have that document.

### Tone

- Be conversational. One question at a time. The user is going to spend 30+
  minutes on this; don't dump 20 questions at once.
- Suggest answers when the user is stuck (e.g. propose a typical "Why this
  role?" template they can edit), but never invent facts (employers,
  schools, dates).
- For required-but-personal fields (work auth, demographics), explain
  the field's purpose briefly, then accept whatever the user provides.
  Match the three-state rule above: skip → empty body, decline → literal
  "Decline to answer".
- After each file is finished, run `__WOLF_BIN__ doctor` again and confirm
  with the user before moving to the next file.

### When the user skips onboarding

If the user wants to run wolf commands before onboarding is complete, that's
fine — wolf will refuse cleanly (with a message naming the file to fill).
Don't block them. But surface the friction once: "tailor will refuse until
profile.md is filled — want to do that now or later?"

### When onboarding is already done

If `__WOLF_BIN__ doctor` reports all profile files ready, skip this section
entirely. Don't re-onboard the user. Move on to whatever they actually asked.

## What wolf does

wolf is a CLI tool that:
- Records job listings the user is interested in
- Tailors their resume and cover letter for each job using AI
- Scores jobs against their profile
- Auto-fills application forms
- Drafts outreach emails to hiring contacts

## Command status (read this before suggesting commands)

> Source of truth: `src/utils/commandStatus.ts` in the wolf source tree.
> Keep this table in sync when commands ship.

| Command | Status |
|---|---|
| `__WOLF_BIN__ init` / `add` / `tailor` / `status` / `doctor` / `job list` / `profile` / `config` / `env` / `mcp serve` | available |
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

### Config & profile management
| Command | What it does |
|---|---|
| `__WOLF_BIN__ config get/set <key> [value]` | Read or edit `wolf.toml` fields by dot-path (e.g. `tailor.model`) |
| `__WOLF_BIN__ profile list` | List all profile directories (default marked with `*`) |
| `__WOLF_BIN__ profile create <name> [--from <src>]` | Create a new profile (clones default unless --from given) |
| `__WOLF_BIN__ profile use <name>` | Switch the default profile (updates `wolf.toml.default`) |
| `__WOLF_BIN__ profile delete <name> --yes` | Delete a profile directory |
| `__WOLF_BIN__ env show / set / clear` | Manage `WOLF_*` API keys in shell |

> Profile data lives in `profiles/<name>/profile.md` and `standard_questions.md`.
> Edit those files directly with any text editor — there is no `__WOLF_BIN__ profile get/set` CLI.

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
`resume.html` directly) and re-run just `__WOLF_BIN__ tailor resume`. The analyst does
not re-run unless you call `__WOLF_BIN__ tailor brief` again.

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
default = "default"   # the profile folder name under profiles/

# Each AI-using command has its own model.
# Format: "<provider>/<model>" where provider is "anthropic" or "openai".

[hunt]
minScore = 0.5                  # 0.0-1.0 - jobs below this are filtered
maxResults = 50                 # max jobs fetched per hunt run
# no model - __WOLF_BIN__ hunt does not call AI

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

### profiles/default/ — three markdown files + attachments

A profile is a directory; the directory name IS the profile identifier
(`appliedProfileId` on jobs and `wolf.toml.default` both store the dirname).
There is no `profile.toml`; identity, demographics, work auth, and address
all live in `profile.md`.

```
profiles/default/
├── profile.md             ← identity facts (name, contact, address, demographics, work auth, clearance)
├── resume_pool.md         ← full experience bank (tailor reads this to write resumes)
├── standard_questions.md  ← application-only Q&A + document pointers (fill reads this)
└── attachments/           ← drop transcript, reference letter, portfolio sample, etc. here
                              (NOT immigration / work-auth documents — those are post-offer, out of scope)
```

**`profile.md`** uses `H1 = category, H2 = field/question` convention. AI agents
(tailor, fill, outreach) include the full file as prompt context — they read
the markdown directly, no field-level extraction.

**`standard_questions.md`** uses the same H1/H2 convention plus `H3 = label`
under the `# Documents` section, where the body of each H3 is a bare file
name inside `attachments/`. Example:

```md
# Documents

## What academic documents do you have?

### Transcript
transcript.pdf
```

**`resume_pool.md`** — the most important file to keep up to date. wolf reads
this when tailoring resumes. Include everything — all past roles, projects,
skills, and education. wolf selects the most relevant content per job.

**`attachments/`** — files referenced by `standard_questions.md`. Files must
live directly in this folder; subdirectories or absolute paths are rejected.
If a file referenced in `standard_questions.md` is missing, `__WOLF_BIN__ fill` pauses
and asks you to drop it in.

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
