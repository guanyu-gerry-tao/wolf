# Use Cases — wolf

Actor is "User" (human via CLI) or "Agent" (AI orchestrator via MCP) unless specified.

## UC-00 · Pre-Installation

**Actor:** User
**Precondition:** None

- 1 - User pastes a GitHub link to an AI and asks how to use the project.
- 2 - AI reads the README, informs the user that wolf can be run via `CLI` or `MCP`. AI should recommend the user initialize via MCP first, and guides the user through the following steps:
   - a - Create a dedicated folder that will serve as the wolf workspace (e.g. `~/wolf-workspace`).
   - b - Install wolf via `npm`.
   - c - Configure the MCP plugin using the copyable config block from the README, which includes `cwd` set to the workspace folder created in step a.
- 3 - User completes the above steps; the MCP server is now configured to start with the correct working directory.

NEXT: AI recommends the user initialize via MCP first. Proceed to UC-01.

## UC-01 · Run Initial Setup (`wolf init`)

**Actor:** User
**Precondition:** wolf is installed; no `wolf.toml` exists in the workspace.

- 1 - User runs `wolf init`.
- 2 - wolf displays the current directory (`pwd`), informs the user it will be used as the wolf workspace, recommends running this command somewhere familiar and easy to manage, and asks for confirmation.
   - 2.1 - If the current directory already contains files → wolf issues an additional warning and asks the user to confirm again.
     - 2.1.1 - If user declines → exit; prompt the user to `cd` to the desired directory and re-run.
- 3 - wolf prompts for profile fields in sequence: name, email, phone, LinkedIn URL, target roles, target locations, work authorization status, willingness to relocate.
   - 3.1 - If user presses Enter on an optional field → skip it; continue to next field.
- 4 - wolf opens `resume_pool.md` in the default editor.
   - 4.1 - If user closes the editor without saving → wolf warns that resume_pool.md is empty; continue.
- 5 - wolf writes `wolf.toml` to the workspace root.
- 6 - wolf checks for `WOLF_ANTHROPIC_API_KEY` in the environment.
   - 6.1 - If set → show masked preview (first 4 + last 4 chars); mark as configured.
   - 6.2 - If not set → print setup instructions; continue (key is not required to complete init).
- 7 - wolf prints a summary of all `WOLF_*` keys (set / not set), lists available CLI commands, suggests running `--help` for details, and exits.

## UC-01.1 · Run Initial Setup (MCP)

**Actor:** AI Agent (e.g. OpenClaw, Claude Code, or Claude Chat)
**Precondition:** wolf is installed; no `wolf.toml` exists in the workspace; AI has the wolf MCP plugin installed.

- 1 - User asks the AI: "I just installed wolf — what do I need to do?"
- 2 - AI reads the `wolf_setup` MCP tool description and learns the required fields for profile info and resume pool content (fields TBD; defined by the tool description).
- 3 - AI asks the user questions to collect all required profile and resume fields, and records the responses.
- 4 - AI calls `wolf_setup` with the collected profile and resume data; wolf generates the workspace file structure, writes `wolf.toml`, and generates `resume_pool.md`. `wolf_setup` returns the generated `resume_pool.md` content, `wolf.toml` content, and whether API keys are configured.
- 5 - AI displays the generated `resume_pool.md` content to the user and asks for confirmation. AI should also display the `wolf.toml` content with natural language descriptions, asking for confirmation.
   - 5.1 - If the user requests changes → AI updates the relevant fields and calls `wolf_setup` again with the corrected data; repeat from step 5.
- 6 - AI confirms setup is complete.
   - 6.1 - If API keys are not configured → AI informs the user they need to set their API key, explains how to register and obtain one, and provides a copyable code block (e.g. `export WOLF_ANTHROPIC_API_KEY=your_key_here`), instructing the user to add it to `~/.zshrc` and then run `source ~/.zshrc` or restart the terminal.

## UC-02.1 · Hunt for Jobs (`wolf hunt`)

**Actor:** User or Agent
**Precondition:** `wolf.toml` exists; at least one provider is configured.

- 1 - User runs `wolf hunt`.
- 2 - wolf reads the provider list from `wolf.toml`.
   - 2.1 - If no providers are configured → print setup hint and exit. (hint TBD)
- 3 - For each provider, wolf fetches job listings via the `JobProvider` interface.
   - 3.1 - If a provider returns an error → log the error, skip that provider, continue with others.
- 4 - wolf deduplicates results (same URL, or same title + company).
- 5 - wolf saves new jobs to SQLite with `status: raw`, `score: null`.
- 6 - wolf prints a summary: N fetched, M duplicates skipped, K new jobs saved.
- 7 - `CLI` hints at next steps (e.g. "Run `wolf score` to evaluate these jobs against your profile.").

## UC-02.2 - Hunt for Jobs (MCP)

**Actor:** AI Agent (e.g. OpenClaw)
**Precondition:** wolf is installed; `wolf.toml` exists with at least one provider configured.

- 1 - User asks the AI: "Can you find me some jobs?" or "Lets go hunting jobs!" or "Use wolf to find me some jobs!"
- 2 - AI calls the `wolf_hunt` MCP tool. No arguments are needed.
- 3 - wolf performs the hunt as described in UC-02.1 step 2-5, and returns the summary of results (N fetched, M duplicates skipped, K new jobs saved) to the AI. AI should then relay this information to the user in a natural language response.
- 4 - AI may suggest next steps (e.g. "I found K new jobs for you. Would you like me to score them against your profile?") and guide the user through the workflow.

## UC-03.1 · Score Jobs (`wolf score`)

**Actor:** User
**Precondition:** At least one job with `score: null` exists in the DB.

- 1 - User runs `wolf score` with optional flags:
   - `--profile <profileId>` → use the specified profile for scoring. (TBD: multi-profile support — currently a placeholder; defaults to `default_profile` in `wolf.toml`.)
   - `--jobid <jobId>` → score only the specified job synchronously, skipping the batch API.
- 2 - wolf reads all jobs with `score: null` OR `status: score_error` from SQLite (or just the specified job if `--jobid` is set).
- 3 - wolf submits jobs to Claude Batch API in a single batch. Each request includes the full JD text and the user's profile (resume, preferences). CLI provides progress updates while polling for batch results. Claude returns a structured response per job containing:
   - structured JD fields (tech stack, sponsorship required, remote, salary range)
   - filter decision: `filtered` or `pass`, with a reason (e.g. "requires visa sponsorship")
   - fit score (0.0–1.0)
   - score justification (e.g. "Strong TypeScript match; lacks required fintech domain experience")
   - 3.1 - If `--jobid` is set → skip batch, make a single synchronous call instead.
   - 3.2 - If a response is malformed or missing required fields → log "Retrying job N/M..." and retry once with a stricter prompt. If the retry also fails → mark the job `status: score_error` with the reason, continue to the next job.
- 4 - wolf writes all results to SQLite: structured fields, filter status, score, and justification.
- 5 - wolf prints a summary (e.g. "Scored N jobs: X high fit (≥0.7), Y medium fit (0.4–0.7), Z filtered, W errors.") and hints at next steps (e.g. "Run `wolf list --jobs` to view scored jobs.").

## UC-03.2 · Score Jobs (MCP)

**Actor:** AI Agent
**Precondition:** `wolf.toml` exists; at least one job with `score: null` exists in the DB.

- 1 - User asks the AI to score jobs (e.g. "Score the jobs you found" or "Which jobs are the best fit for me?").
- 2 - AI calls `wolf_score` with no arguments to score all pending jobs.
   - 2.1 - To score a single job → AI calls `wolf_score` with `{ jobId }`.
   - 2.2 - `profileId` arg is a placeholder for future multi-profile support (TBD); omit for now.
- 3 - wolf performs scoring as described in UC-03.1 steps 2–5 and returns per-job results including score, filter status, justification, and any errors.
- 4 - AI presents the results to the user in a natural language summary, highlighting top matches.

## UC-04.1 · List (`wolf list`)

**Actor:** User
**Precondition:** At least one record exists in the local DB.

`wolf list` requires exactly one of `--jobs` or `--companies`.

**Variant — `wolf list --jobs`:**

- 1 - User runs `wolf list --jobs` with optional filters:
   - `--profile <profileId>` → use evaluations from the specified profile. (TBD: multi-profile support — currently a placeholder; defaults to `default_profile` in `wolf.toml`.)
   - `--score <n>` → show only jobs with score ≥ n.
   - `--selected` → show only selected jobs.
   - `--status <value>` → filter by status field.
   - `--date <days>` → show only jobs added within the last N days (e.g. `7`).
   - `--fromcompany <companyId>` → show only jobs from the given company (use `wolf list --companies` to find company IDs).
- 2 - wolf queries SQLite with the given filters and returns results sorted by score descending.
- 3 - wolf prints a table: company, title, score, filter status, selection status, JD link.
   - 3.1 - If no jobs match → print a helpful hint.

**Variant — `wolf list --companies`:**

- 1 - User runs `wolf list --companies`.
- 2 - wolf returns all distinct companies in the DB with their IDs.
- 3 - wolf prints a table: companyId, company name.

## UC-04.2 · List (MCP)

**Actor:** AI Agent
**Precondition:** At least one record exists in the local DB.

**Variant — jobs:**

- 1 - User asks the AI to show jobs (e.g. "Show me the jobs you found" or "Which jobs scored above 0.7?" or "Show me jobs at Stripe").
- 2 - AI derives filter arguments from the user's request and calls `wolf_list` with `{ mode: "jobs", ...filters }` (e.g. `{ mode: "jobs", minScore: 0.7, status: "raw", date: 7, fromCompanyId: "stripe-001" }`). Multiple filters can be combined. `profileId` is a placeholder arg for future multi-profile support (TBD); omit for now.
- 3 - wolf returns a structured list with jobId, company, title, score, filter status, and JD link.
- 4 - AI presents the results to the user with numbered markers (e.g. "1. Stripe — SWE, score 0.85 ...").

**Variant — companies:**

- 1 - User asks the AI to show companies (e.g. "What companies are in my list?").
- 2 - AI calls `wolf_list` with `{ mode: "companies" }`.
- 3 - wolf returns all distinct companies with their IDs.
- 4 - AI presents the company list to the user. AI may follow up by calling `wolf_list` with `{ mode: "jobs", fromCompanyId: "..." }` if the user wants to drill into a specific company.

## UC-05.1 · Select Jobs (`wolf select`)

**Actor:** User
**Precondition:** Jobs in DB have been scored.

- 1 - User runs `wolf select`.
- 2 - wolf loads scored jobs using the same query logic as `wolf list --jobs`, sorted by score descending. wolf opens an interactive TUI showing company, title, score, status, and JD URL as plain text.
- 3 - User navigates the list and toggles selection on jobs they want to apply for. The `selected` field is updated to `true` or `false` in the DB accordingly.

## UC-05.2 · Select Jobs (MCP)

**Actor:** AI Agent
**Precondition:** Jobs in DB have been scored.

- 1 - User reviews the numbered list from UC-04.2 and tells the AI which jobs to select (e.g. "I want jobs 1, 3, and 5").
- 2 - AI maps the user's numbers to jobIds from the prior `wolf_list` response and calls `wolf_select` with `{ jobIds: [...], action: "select" }`.
- 3 - wolf updates the `selected` field to `true` for the given jobs.
   - 3.1 - To deselect → AI calls `wolf_select` with `{ jobIds: [...], action: "unselect" }`.
- 4 - AI confirms the selection to the user.

## UC-06.1 · Tailor Resume (`wolf tailor`)

**Actor:** User
**Precondition:** `profile.toml` exists; `resume_pool.md` exists; target job is in the DB.

- 1 - User runs `wolf tailor` with optional flags:
   - `--profile <profileId>` → use the specified profile. (TBD: multi-profile support — currently a placeholder; defaults to `default_profile` in `wolf.toml`.)
   - `--jobid <jobId>` → tailor only the specified job synchronously; otherwise tailors all selected jobs.
   - `--diff` → print a before/after comparison of every changed bullet per job.
   - `--cover-letter` → after tailoring completes, generate a cover letter for each job in the batch (same logic as UC-07.1).
- 2 - wolf reads all jobs with `selected: true` AND (`status: scored` OR `status: tailor_error`) from SQLite (or just the specified job if `--jobid` is set), extracting JD, company, title, and other relevant fields.
- 3 - wolf reads the user's profile from `profile.toml` at profile's folder and resume bullet points from `resume_pool.md` under that folder.
- 4 - wolf submits all jobs to Claude Batch API in a single batch, each request including the JD text and resume pool. CLI provides progress updates while polling.
   - 4.1 - If `--jobid` is set → skip batch, make a single synchronous call instead.
   - 4.2 - If a response is missing or completely unreadable (not valid `.tex`) → mark `status: tailor_error`, continue to the next job. Partial or compilable-but-flawed `.tex` proceeds to step 5 and is handled by the compile-and-review loop (steps 6–8).
The following steps (5–8) run per-job after the batch results are received. Each job goes through its own independent review loop.
- 5 - wolf writes the tailored `.tex` file to the workspace.
- 6 - wolf compiles `.tex` to PDF via `xelatex`.
   - 6.1 - If `xelatex` is not installed → skip steps 6–8 for all jobs, print a warning, and continue to step 9.
   - 6.2 - If compilation fails → send the `.tex` and error log back to Claude to fix, then retry compilation. If it still fails → mark `status: tailor_error`, skip to next job.
- 7 - wolf takes screenshots of the PDF: 1 JPG per page, capturing at most 2 pages.
- 8 - wolf sends the screenshot(s) and the `.tex` source to Claude with the instruction: "If you see a second page or orphan words, fix the `.tex` with minimal changes and return the updated source. Otherwise return LGTM."
   - 8.1 - If Claude returns updated `.tex` → go back to step 6. Repeat up to **3 times total** across steps 6–8 for this job.
   - 8.2 - If Claude returns LGTM → continue to next job.
   - 8.3 - After 3 attempts without LGTM → wolf checks the final PDF page count: if 1 page → accept and continue; if 2 pages → mark `status: tailor_error`, continue to next job.
- 9 - wolf prints a summary: jobs tailored, errors, and output file paths.
- 10 - If `--cover-letter` was set → run UC-07.1 for all successfully tailored jobs in this batch.

## UC-06.2 · Tailor Resume (MCP)

**Actor:** AI Agent
**Precondition:** `wolf.toml` exists; active `profile.toml` exists; `resume_pool.md` exists; target job is in the DB.

- 1 - User asks the AI to tailor their resume for a job (e.g. "Tailor my resume for job 42").
- 2 - AI calls `wolf_tailor` with `{ jobId }` to tailor a specific job, or with no arguments to tailor all selected jobs. `profileId` is a placeholder arg for future multi-profile support (TBD); omit for now.
- 3 - wolf performs tailoring as described in UC-06.1 steps 2–10 and returns per-job results: PDF path, page count, number of visual review iterations used, cover letter path (if generated), and any errors (`tailor_error` jobs are included with reason).
- 4 - AI presents a summary to the user: which jobs were tailored successfully, which hit `tailor_error` and why, and offers next steps (e.g. run `wolf_cover_letter` or `wolf_fill`).

## UC-07.1 · Generate Cover Letter (`wolf cover-letter`)

**Actor:** User
**Precondition:** Target job is in the DB; tailored resume has been generated for the job.

- 1 - (Entered from UC-06.1 when `--cover-letter` is set, or user runs `wolf cover-letter [--jobid <jobId>]` directly, or triggered automatically from UC-08.1 when a CL field is detected and no CL exists.)
- 2 - wolf reads all selected jobs with no existing cover letter path in evaluations (or just the specified job if `--jobid` is set). For each, wolf reads the JD, user profile, and tailored resume.
- 3 - wolf checks whether the JD or `companies` table contains a company description.
   - 3.1 - If a company description is available → full CL including a "why this company" section.
   - 3.2 - If no company description is found → CL focused on user+job fit only; the "why this company" section is omitted rather than hallucinated.
- 4 - wolf calls Claude API to draft the cover letter.
- 5 - wolf saves the draft as a `.md` file alongside the tailored resume and records the path in `evaluations.coverLetterPath`.
- 6 - wolf converts `.md` to PDF via `md-to-pdf`. If `md-to-pdf` is not installed → skip PDF conversion for all jobs, print a warning, and continue.
- 7 - wolf prints the output file paths.

## UC-07.2 · Generate Cover Letter (MCP)

**Actor:** AI Agent
**Precondition:** Target job is in the DB; tailored resume has been generated for the job.

- 1 - User asks the AI to generate a cover letter (e.g. "Write a cover letter for job 42"), or AI triggers this automatically during UC-08.2 when a CL field is detected.
- 2 - AI calls `wolf_cover_letter` with `{ jobId }`. `profileId` is a placeholder arg for future multi-profile support (TBD); omit for now.
- 3 - wolf generates the cover letter as described in UC-07.1 steps 2–6 and returns the cover letter content, `.md` path, PDF path (if conversion succeeded), and whether company context was available.
- 4 - AI displays the cover letter content to the user for review.
   - 4.1 - If the user requests changes → AI calls `wolf_cover_letter` again with revision instructions; repeat from step 4.

## UC-08.1 · Fill Application Form (`wolf fill`)

> TODO: Fill is complex. Design deferred.

## UC-08.2 · Fill Application Form (MCP)

> TODO: Fill is complex. Design deferred.

## UC-09.1 · Send Outreach Email (`wolf reach`)

> TODO: Outreach is complex. Design deferred.

## UC-09.2 · Send Outreach Email (MCP)

> TODO: Outreach is complex. Design deferred.

## UC-10.1 · Add Profile (`wolf profile add`)

> TODO

## UC-10.2 · Edit Profile (`wolf profile edit`)

> TODO

## UC-10.3 · Delete Profile (`wolf profile delete`)

> TODO

## UC-10.4 · Backup Workspace (`wolf backup`)

> TODO

## UC-12 · Manage Environment Variables (`wolf env`)

**Actor:** User
**Note:** CLI only — env keys are shell-level and managed outside the MCP server.

**Variant — show (`wolf env show`):**

- 1 - wolf reads all `WOLF_*` keys from the current environment.
- 2 - For each key:
   - 2.1 - If set → print the key name and masked value (first 4 + last 4 chars).
   - 2.2 - If not set → print the key name marked as "not set".

**Variant — clear (`wolf env clear`):**

- 1 - wolf scans shell RC files for `WOLF_*` export lines.
   - 1.1 - If no RC file is found → print a warning and exit without modifying any files.
- 2 - wolf removes those lines from the RC file.
- 3 - wolf prints `unset WOLF_<KEY>` commands for each removed key (for the user to run in the current session).

## UC-13 · End-to-End Agent Workflow (MCP)

**Actor:** Agent (e.g. OpenClaw)
**Precondition:** wolf MCP server is running with correct `cwd`; workspace is initialized.

- 1 - Agent calls `wolf_hunt`. wolf fetches and saves new jobs; returns summary.
- 2 - Agent calls `wolf_score` with no arguments. wolf scores all pending jobs; returns per-job results.
   - 2.1 - Agent filters out jobs below the score threshold.
- 3 - Agent calls `wolf_list` with `{ minScore: <threshold>, selected: false }` and presents the numbered results to the user.
- 4 - User tells the agent which jobs to select (e.g. "jobs 1, 3, 5"). Agent calls `wolf_select` with `{ jobIds: [...], action: "select" }`.
- 5 - For each selected job, agent calls `wolf_tailor` with `{ jobId }`. wolf returns the tailored resume PDF path and change summary.
- 6 - Agent calls `wolf_fill` with `{ jobId, dryRun: false }`.
- 7 - wolf fills and submits the form; returns screenshot and updated status.
- 8 - Agent calls `wolf_reach` with `{ company, jobId, send: true }`.
- 9 - wolf sends the outreach email; returns confirmation.
