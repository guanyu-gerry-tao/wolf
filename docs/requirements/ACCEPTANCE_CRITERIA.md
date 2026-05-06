# Acceptance Criteria — wolf

Format: Given [context], When [action], Then [outcome].
Each section corresponds to a User Story and Use Case.

---

## AC-01 · Initial Setup (`wolf init`)

**Story:** US-01 · **Use case:** UC-01.1.1, UC-01.1.2

**AC-01-1 — Happy path**
- Given wolf is installed and no `wolf.toml` exists
- When the user runs `wolf init` and completes all prompts
- Then `wolf.toml` is written to the workspace root containing all provided profile fields

**AC-01-2 — Workspace confirmation**
- Given the user provides a workspace path that already contains files
- When wolf prompts for confirmation
- Then wolf does not proceed until the user explicitly confirms

**AC-01-3 — API key status summary**
- Given the user completes `wolf init`
- When the wizard finishes
- Then wolf always prints a summary listing each `WOLF_*` key as "set" (masked) or "not set", regardless of whether keys were configured during this run

**AC-01-4 — Resume pool opened**
- Given wolf reaches the resume step
- When wolf opens `resume_pool.md`
- Then the file opens in the user's default editor; wolf waits for the editor to close before continuing

**AC-01-5 — Scriptable empty init**
- Given an automated agent needs a non-interactive workspace
- When it runs `wolf init --preset empty`
- Then wolf writes schema-valid `wolf.toml`, `profiles/default/profile.toml`, an empty `profiles/default/attachments/` directory, and `data/` without prompting

**AC-01-6 — Dev init isolation**
- Given a dev build invoked as `npm run wolf -- init --preset empty`
- When `WOLF_DEV_HOME=/tmp/wolf-test/<suite>/<run-id>/workspaces/<workspace-id>` is set
- Then all workspace files are created under that test workspace and `wolf.toml` contains `[instance].mode = "dev"`

**AC-01-7 — Stable build rejects dev workspaces**
- Given the stable build is running
- When the user passes `wolf init --dev`
- Then wolf exits with a clear error telling the user to run `npm run build:dev` from the clone

---

## AC-02 · Job Discovery (`wolf hunt`)

**Story:** US-02 · **Use case:** UC-02.1.1, UC-02.1.2, UC-02.2.1, UC-02.2.2

**AC-02-1 — Jobs saved to DB**
- Given at least one provider is configured in `wolf.toml`
- When the user runs `wolf hunt`
- Then all fetched jobs are saved to SQLite with `status: raw` and `score: null`

**AC-02-2 — Deduplication**
- Given a job with the same URL already exists in the DB
- When `wolf hunt` fetches the same job again
- Then the duplicate is not inserted; the existing record is unchanged

**AC-02-3 — Provider failure isolation**
- Given one of two configured providers returns an HTTP error
- When `wolf hunt` runs
- Then wolf logs the error for the failing provider and still saves results from the successful provider

**AC-02-4 — Summary output**
- Given `wolf hunt` completes
- When results are printed
- Then the output includes: number of jobs fetched, duplicates skipped, and new jobs saved

---

## AC-03 · Job Scoring (`wolf score`)

**Story:** US-03 · **Use case:** UC-03

**AC-03-1 — Scores are saved**
- Given unscored jobs exist in the DB
- When `wolf score` completes
- Then every job that passed dealbreaker filters has a score between 0.0 and 1.0 saved in SQLite

**AC-03-2 — Dealbreaker filtering**
- Given a job requires visa sponsorship and the user's profile states they cannot provide it
- When wolf applies hard filters
- Then that job is set to `status: filtered` and excluded from scoring output

**AC-03-3 — Score justification required**
- Given a Claude API response for scoring
- When the response is parsed
- Then wolf rejects any score that does not include a justification string

**AC-03-4 — Single-job flag**
- Given the user runs `wolf score --single <jobId>`
- When scoring completes
- Then only that job is scored synchronously; the DB is updated immediately

---

## AC-04 · Resume Tailoring (`wolf tailor`)

**Story:** US-04 · **Use case:** UC-04

**AC-04-1 — Output files created**
- Given a valid jobId and a populated `resume_pool.md`
- When `wolf tailor <jobId>` completes successfully
- Then `data/jobs/<dir>/src/tailoring-brief.md`, `src/resume.html`, and `resume.pdf` are written to the workspace, and the resume PDF path is recorded on the Job row

**AC-04-2 — Factual accuracy preserved**
- Given Claude rewrites bullet points
- When the output is inspected
- Then no new company names, dates, metrics, or technical claims are introduced that were not in the original resume
- AND no entire sections (e.g. Education, Skills, Projects) are invented when the resume pool lacks the underlying data
- AND section ordering in the generated resume follows the order of sections in the resume pool — the writer must not reorder sections to match a perceived convention (e.g. moving Experience above Skills when the pool put Skills first)

**AC-04-3 — Diff output**
- Given the user runs `wolf tailor <jobId> --diff`
- When tailoring completes
- Then the terminal prints a before/after comparison of every changed bullet point

**AC-04-4 — Single-page guard**
- Given the tailored resume body would overflow one page at default rendering parameters
- When the fit-loop runs (deterministic binary search over font-size / line-height / margin)
- Then wolf shrinks the layout within configured floors until the PDF fits one page; if even the floor parameters overflow, wolf throws `CannotFitError` and asks the user to cut content

---

## AC-05 · Cover Letter Generation (`wolf tailor --cover-letter`)

**Story:** US-05 · **Use case:** UC-05

**AC-05-1 — Output files created**
- Given a valid jobId
- When `wolf tailor <jobId>` completes (cover letter is on by default; `--no-cover-letter` skips it)
- Then `data/jobs/<dir>/src/cover_letter.html` and `cover_letter.pdf` are written to the workspace alongside the tailored resume, and the cover letter PDF path is recorded on the Job row

**AC-05-2 — Cover letter references the JD**
- Given a job description with a specific role title and company name
- When the cover letter is generated
- Then the cover letter includes the correct role title and company name

**AC-05-3 — No system dependencies**
- Given a fresh machine with only `npm install` run
- When cover letter generation runs
- Then it succeeds without any system-level tooling installed (no xelatex, no md-to-pdf, no ImageMagick); Playwright bundles its own Chromium

---

## AC-06 · Form Filling (`wolf fill`)

**Story:** US-06 · **Use case:** UC-06

**AC-06-1 — Dry-run prints mapping only**
- Given the user runs `wolf fill <jobId> --dry-run`
- When wolf analyzes the form
- Then the field mapping is printed to the terminal and no form fields are modified

**AC-06-2 — Live fill updates job status**
- Given the user runs `wolf fill <jobId>` (no dry-run)
- When the form is submitted successfully
- Then the job's status in SQLite is updated to `applied`

**AC-06-3 — Screenshot saved**
- Given `wolf fill` completes (dry-run or live)
- When the command exits
- Then a screenshot of the final page state is saved to the workspace

**AC-06-4 — Single Claude call**
- Given wolf detects form fields on a page
- When the fill pipeline runs
- Then exactly one Claude API call is made for field mapping; subsequent fill actions are purely programmatic

**AC-06-5 — Resume upload handled**
- Given the form has a file upload field for a resume
- When wolf fills the form
- Then the tailored resume PDF for that job is attached via `setInputFiles()`

---

## AC-07 · Outreach (`wolf reach`)

**Story:** US-07 · **Use case:** UC-07

**AC-07-1 — Draft saved before send**
- Given the user runs `wolf reach <company>`
- When the draft is generated
- Then it is saved as a `.md` file in the workspace and printed to the terminal before any send action

**AC-07-2 — Send requires explicit flag and confirmation**
- Given the user runs `wolf reach <company>` without `--send`
- When the command completes
- Then no email is sent; the user must re-run with `--send` and confirm the prompt

**AC-07-3 — Outreach logged**
- Given the user confirms and sends an email via `wolf reach --send`
- When Gmail API returns success
- Then the outreach is recorded in SQLite (company, contact email, timestamp)

**AC-07-4 — Email inferred when not found**
- Given no email address is found for the contact
- When wolf generates the draft
- Then wolf uses an inferred email format (e.g. `firstname.lastname@company.com`) and notes the confidence level in the terminal output

---

## AC-08 · Job Tracking (`wolf status` + `wolf job list`)

**Story:** US-08 · **Use case:** UC-08

Job tracking split into two commands (see DECISIONS.md 2026-04-18 · "Nouns over god-views"). `wolf status` is the aggregate dashboard that never grows with new features; `wolf job list` owns filtered inspection of individual rows.

### `wolf status` — dashboard summary

**AC-08-1 — Counter output**
- Given at least one job exists in the DB
- When the user runs `wolf status`
- Then one count per registered module is printed (e.g. `tracked`, `tailored`, `applied`), one per line, labels left-aligned

**AC-08-2 — Resilient aggregation**
- Given one module's counter throws (e.g. DB error for that specific count)
- When the user runs `wolf status`
- Then the remaining counters are still printed; the failed counter shows `0 [error: ...]` inline so the dashboard is not lost to a single fault

### `wolf job list` — filtered list view

Follows the standard shape for `wolf <noun> list` commands — see DECISIONS.md 2026-04-18 · "Standard shape for `wolf <noun> list` commands".

**AC-08-3 — Default table output**
- Given at least one job exists in the DB
- When the user runs `wolf job list`
- Then a table is printed with columns: id (short), company, title, status, score; default limit of 20 rows

**AC-08-4 — Structured filters (AND semantics)**
- Given the user runs `wolf job list --status applied --min-score 0.7 --source LinkedIn`
- When the command runs
- Then only jobs matching all three structured filters are shown

**AC-08-5 — Search filter**
- Given the user runs `wolf job list --search acme`
- When the command runs
- Then only jobs whose title OR company name OR location contain "acme" (case-insensitive substring) are shown

**AC-08-6 — Repeatable search for OR**
- Given the user runs `wolf job list --search google --search apple`
- When the command runs
- Then jobs matching EITHER search term (across title, company name, or location) are shown — multiple `--search` flags OR at the top level

**AC-08-6b — Search composes with structured filters via AND**
- Given the user runs `wolf job list --search acme --status applied --min-score 0.7`
- When the command runs
- Then only jobs matching the search AND every structured filter are shown — the search OR group and each structured filter are combined with AND at the top level

**AC-08-6c — Search terms are SQL LIKE patterns with `%`/`_` as wildcards**
- Given the user's `--search <term>` value contains `%` or `_`
- When the command runs
- Then `%` matches any sequence and `_` matches any single character — i.e. `--search "C_Dev"` matches `CADev`, `C1Dev`, …, and `--search "50%"` matches `50`, `500`, `50abc`, etc.
- This is documented behavior, not a bug — AI callers can use it deliberately. Human callers who don't know about wildcards see more matches than expected, never fewer (no silent-empty failure)

**AC-08-7 — Time range**
- Given the user runs `wolf job list --start 2026-04-01 --end 2026-04-18`
- When the command runs
- Then only jobs with `createdAt` between the two dates inclusive are shown; invalid dates produce a clear error

**AC-08-8 — Overflow footer**
- Given the total matching rows exceed the limit
- When the command runs
- Then after the table wolf prints a `... N more — use --limit <n> to see more` footer with the accurate remaining count

**AC-08-9 — Empty state**
- Given no jobs match the filters (or no jobs exist)
- When the user runs `wolf job list`
- Then wolf prints `No jobs match.` instead of an empty table

**AC-08-10 — Machine-readable output**
- Given the user runs `wolf job list --json`
- When the command runs
- Then wolf prints the full result object as pretty-printed JSON (jobs array plus `totalMatching` and `limited`); no table, no overflow footer

**AC-08-11 — Invalid input is rejected, not silently empty**
- Given the user runs `wolf job list --status bogus` (or `--min-score abc`, `--start not-a-date`, `--search ""`, `--limit 0`)
- When the command runs
- Then wolf throws with a clear error message (listing valid statuses, or naming the offending flag); it does NOT silently return zero rows

**AC-08-12 — No `--all`, no JD content search**
- Given the user wants to dump every row or search JD text
- When the user looks for a flag
- Then there is no `--all` flag (use `--limit <n>` explicitly); JD content is not searchable via the CLI (`grep -l X data/jobs/*/jd.md` is the escape hatch)

---

## AC-09 · Environment Management (`wolf env`)

**Story:** US-09 · **Use case:** UC-09

**AC-09-1 — Show masks key values**
- Given `WOLF_ANTHROPIC_API_KEY` is set in the environment
- When the user runs `wolf env show`
- Then the output shows the key name and a masked value (first 4 + last 4 chars); the full key is never printed

**AC-09-2 — Show marks unset keys**
- Given `WOLF_APIFY_API_TOKEN` is not set
- When the user runs `wolf env show`
- Then the output marks it as "not set" without error

**AC-09-3 — Clear removes RC lines**
- Given `WOLF_*` export lines exist in `~/.zshrc`
- When the user runs `wolf env clear`
- Then those lines are removed from `~/.zshrc`

**AC-09-4 — Clear prints unset commands**
- Given `wolf env clear` runs successfully
- When the output is printed
- Then wolf prints `unset WOLF_<KEY>` commands for each removed key so the user can clear them from the current session

---

## AC-10 · Agent-Driven Workflow (MCP)

**Story:** US-10 · **Use case:** UC-10

**AC-10-1 — `wolf_add` returns jobId**
- Given a valid `{ title, company, jdText }` payload
- When an agent calls `wolf_add`
- Then wolf saves the job and returns a `jobId` in the response

**AC-10-2 — `wolf_tailor` returns file paths and screenshot**
- Given a valid `jobId` with an associated JD
- When an agent calls `wolf_tailor`
- Then wolf returns the tailored resume PDF path and a base64 screenshot of the PDF

**AC-10-3 — All tools return structured JSON**
- Given any MCP tool call
- When the tool completes (success or error)
- Then the response conforms to the tool's declared output schema

---

## AC-11 · Profile Data Governance (`wolf profile`)

**Story:** US-10 · **Use case:** UC-10.1, UC-10.2, UC-10.3

**AC-11-1 — Profile schema reference**
- Given a dev workspace has been initialized
- When the user runs `wolf profile fields`, `wolf profile fields --required`, `wolf profile fields --json`, or `wolf profile fields <path>`
- Then wolf prints the `PROFILE_FIELDS` source-of-truth metadata, supports required-only and machine-readable output, and rejects unknown paths with a clear error

**AC-11-2 — Read and show profile data**
- Given the active profile contains a known value
- When the user runs `wolf profile show` and `wolf profile get <path>`
- Then `show` prints the raw active `profile.toml` with comments preserved, and `get` prints only the requested field value for piping

**AC-11-3 — Scalar field update**
- Given the active profile contains an editable top-level field
- When the user runs `wolf profile set <path> <value>`
- Then wolf surgically updates only that field, preserves surrounding comments/formatting, and the new value is visible through `wolf profile get <path>`

**AC-11-4 — Multiline field update from file**
- Given a multiline profile field and a temporary input file under `/tmp/wolf-test/`
- When the user runs `wolf profile set <path> --from-file <file>`
- Then wolf stores the file content without a phantom trailing newline and later reads it back correctly

**AC-11-5 — Array entry add, edit, and remove**
- Given the user needs to manage resume-source entries
- When the user runs `wolf profile add experience|project|education`, edits fields on the returned id, and removes the entry with `--yes`
- Then wolf creates a stable `[[experience]]`, `[[project]]`, or `[[education]]` entry, allows only supported per-entry fields, and removes only the requested id

**AC-11-6 — Custom question add and remove**
- Given the user has a reusable application question
- When the user runs `wolf profile add question --prompt <text> --answer <text>` and later removes the returned id with `wolf profile remove question <id> --yes`
- Then wolf creates a custom `[[question]]` entry with `required = false`, stores prompt and answer, and removes that custom entry without affecting wolf-builtin questions

**AC-11-7 — Builtin question protection**
- Given a wolf-builtin question exists in the active profile
- When the user attempts to remove it or change its prompt / required flag
- Then wolf rejects the operation with a clear error and tells the user to clear the answer instead

**AC-11-8 — Profile write validation**
- Given the user passes an unknown path, unknown array type, duplicate unsafe id, missing value, or TOML-breaking value
- When `wolf profile set`, `add`, or `remove` runs
- Then wolf exits non-zero with a clear message and does not silently corrupt `profile.toml`

---

## AC-12 · Job Data Governance (`wolf job show|get|set|fields`)

**Story:** US-08 · **Use case:** UC-08

**AC-12-1 — Job schema reference**
- Given a dev workspace contains at least one job
- When the user runs `wolf job fields`, `wolf job fields --required`, `wolf job fields --json`, or `wolf job fields <name>`
- Then wolf prints the `JOB_FIELDS` source-of-truth metadata, supports required-only and machine-readable output, and rejects unknown field names with a clear error

**AC-12-2 — Read and show job data**
- Given a job exists with JD prose
- When the user runs `wolf job show <id>`, `wolf job show <id> --json`, and `wolf job get <id> <field>`
- Then `show` prints every flat job column plus `description_md`, JSON output is machine-readable, and `get` prints only the requested field value for piping

**AC-12-3 — Editable job field update**
- Given a job exists
- When the user runs `wolf job set <id> <field> <value>` on editable fields such as `status`, `score`, `remote`, or `description_md --from-file`
- Then wolf coerces the CLI string according to `JOB_FIELDS`, persists the typed value, and the value round-trips through `wolf job get`

**AC-12-4 — Salary range convention**
- Given a job exists with unknown salary fields
- When the user runs `wolf job set <id> salaryLow 0` and `wolf job set <id> salaryHigh 30000`
- Then both commands succeed, `salaryLow` reads back as `0`, `salaryHigh` reads back as `30000`, and wolf treats `0` as explicit unpaid while blank/null remains unknown

**AC-12-5 — Job write validation**
- Given the user passes an unknown field, invalid enum, invalid boolean, invalid number, or removed sentinel such as `salaryLow unpaid`
- When `wolf job set` runs
- Then wolf exits non-zero with a clear validation error and leaves the previous job value unchanged

**AC-12-6 — System-managed fields are read-only**
- Given system-managed fields such as `id`, `companyId`, `createdAt`, and `updatedAt` exist on a job row
- When the user reads them with `wolf job show` or `wolf job get`
- Then the values are visible
- AND when the user tries to update them with `wolf job set`
- Then wolf rejects the write as system-managed
