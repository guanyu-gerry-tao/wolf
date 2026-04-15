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
- Given a valid jobId and a `.tex` resume source
- When `wolf tailor <jobId>` completes successfully
- Then a tailored `.tex` file and a compiled PDF are written to the workspace

**AC-04-2 — Factual accuracy preserved**
- Given Claude rewrites bullet points
- When the output is inspected
- Then no new company names, dates, metrics, or technical claims are introduced that were not in the original resume

**AC-04-3 — Diff output**
- Given the user runs `wolf tailor <jobId> --diff`
- When tailoring completes
- Then the terminal prints a before/after comparison of every changed bullet point

**AC-04-4 — Page count guard**
- Given the tailored resume exceeds the original page count
- When the refinement loop runs
- Then wolf re-prompts Claude to shorten content until the page count matches

---

## AC-05 · Cover Letter Generation (`wolf tailor --cover-letter`)

**Story:** US-05 · **Use case:** UC-05

**AC-05-1 — Output files created**
- Given a valid jobId
- When `wolf tailor <jobId> --cover-letter` completes
- Then a `.md` and a PDF cover letter are written to the workspace alongside the tailored resume

**AC-05-2 — Cover letter references the JD**
- Given a job description with a specific role title and company name
- When the cover letter is generated
- Then the cover letter includes the correct role title and company name

**AC-05-3 — PDF compilation failure is non-blocking**
- Given `md-to-pdf` is not installed
- When cover letter generation runs
- Then wolf saves the `.md` file, prints a warning about PDF compilation, and exits cleanly

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

## AC-08 · Job Tracking (`wolf status`)

**Story:** US-08 · **Use case:** UC-08

**AC-08-1 — Table output**
- Given at least one job exists in the DB
- When the user runs `wolf status`
- Then a table is printed with columns: job title, company, score, status, date added

**AC-08-2 — Status filter**
- Given the user runs `wolf status --status applied`
- When the command runs
- Then only jobs with `status: applied` are shown

**AC-08-3 — Score filter**
- Given the user runs `wolf status --score 0.7`
- When the command runs
- Then only jobs with score ≥ 0.7 are shown

**AC-08-4 — Empty state**
- Given no jobs exist in the DB
- When the user runs `wolf status`
- Then wolf prints a helpful message (e.g. "No jobs tracked yet. Run `wolf hunt` to get started.") instead of an empty table

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
