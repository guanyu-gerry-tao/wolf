# Manual Testing Guide

Step-by-step instructions for testing wolf locally before merging to main.

> **Important:** `wolf init` creates `wolf.toml` and `data/` in your **current directory**.
> Always `cd` to a dedicated test folder before running — never run it inside the wolf project repo.

## Setup

```bash
# Build and install globally (run from the wolf repo)
cd ~/path/to/wolf
npm run build
npm link
wolf --help   # verify it works

# Create a dedicated test workspace
mkdir ~/test-wolf && cd ~/test-wolf
```

---

## UC-01 · `wolf init` (CLI)

```bash
cd ~/test-wolf
wolf init
```

**Scenario 1A — Happy path**
- [ ] Displays current pwd and asks for confirmation
- [ ] Prompts in sequence: name, email, phone, LinkedIn URL, target roles, target locations, work auth, willing to relocate
- [ ] Optional fields can be skipped with Enter
- [ ] Opens `resume_pool.md` in default editor; waits for editor to close
- [ ] Writes `wolf.toml` to `~/test-wolf/`
- [ ] Prints summary of all `WOLF_*` keys (set / not set)
- [ ] Prints available CLI commands and suggests `--help`

**Scenario 1B — Cancel on confirmation**
- [ ] When user answers `n` at the confirmation prompt → exits without creating `wolf.toml`

**Scenario 1C — Directory already has files**
```bash
touch ~/test-wolf/somefile.txt
wolf init
```
- [ ] Shows additional warning about existing files
- [ ] Does not proceed until user confirms twice

**Scenario 1D — API key not set**
```bash
unset WOLF_ANTHROPIC_API_KEY
wolf init
```
- [ ] Prints setup instructions for the missing key
- [ ] Init completes successfully (key not required)

**Scenario 1E — Re-run with existing `wolf.toml`**
```bash
wolf init   # run a second time
```
- [ ] Detects existing `wolf.toml`, warns user, and asks for confirmation before overwriting

---

## UC-01.1 · `wolf init` (MCP)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wolf": {
      "command": "wolf",
      "args": ["mcp", "serve"],
      "cwd": "/Users/<you>/test-wolf",
      "env": {
        "WOLF_ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Restart Claude Desktop. In a new conversation:

> "I just installed wolf — what do I need to do?"

- [ ] AI reads `wolf_setup` tool description and asks for profile fields
- [ ] AI collects name, email, phone, LinkedIn, roles, locations, work auth
- [ ] AI calls `wolf_setup` once with all fields
- [ ] `wolf.toml` is created in the `cwd` specified above
- [ ] AI displays generated `resume_pool.md` and `wolf.toml` contents and asks for confirmation
- [ ] If user requests changes → AI calls `wolf_setup` again with corrected data
- [ ] If API key not set → AI explains how to set it and provides copyable export command

---

## UC-02 · `wolf hunt`

```bash
cd ~/test-wolf
wolf hunt
```

**Scenario 2A — Happy path**
- [ ] Reads provider list from `wolf.toml`
- [ ] Fetches jobs and saves with `status: raw`, `score: null`
- [ ] Prints: N fetched, M duplicates skipped, K new jobs saved
- [ ] Hints at running `wolf score` next

**Scenario 2B — Deduplication**
- [ ] Run `wolf hunt` twice — second run shows duplicates skipped, DB unchanged

**Scenario 2C — Provider failure**
- [ ] If one provider errors → logs the error, continues with other providers, still saves results

**Scenario 2D — No providers configured**
- [ ] Prints setup hint and exits cleanly

---

## UC-03 · `wolf score`

```bash
wolf score
```

**Scenario 3A — Batch scoring**
- [ ] Reads all jobs with `score: null` OR `status: score_error`
- [ ] Submits to Claude Batch API; CLI prints progress while polling
- [ ] Results written to SQLite: structured fields, filter status, score (0.0–1.0), justification
- [ ] Prints summary: X high fit, Y medium, Z filtered, W errors

**Scenario 3B — Single job**
```bash
wolf score --jobid <jobId>
```
- [ ] Skips Batch API, makes synchronous call
- [ ] DB updated immediately

**Scenario 3C — Malformed response retry**
- [ ] On malformed response → logs "Retrying job N/M..."
- [ ] On second failure → marks `status: score_error` with reason, continues

**Scenario 3D — Retry picks up score_error jobs**
- [ ] Run `wolf score` after a previous run that left some `score_error` jobs → those jobs are included

---

## UC-04 · `wolf list`

```bash
wolf list --jobs
wolf list --companies
```

**Scenario 4A — List jobs, no filter**
- [ ] Returns table: company, title, score, filter status, selected, JD link
- [ ] Sorted by score descending

**Scenario 4B — Filters**
```bash
wolf list --jobs --score 0.7
wolf list --jobs --selected
wolf list --jobs --status raw
wolf list --jobs --date 7
wolf list --jobs --fromcompany <companyId>
```
- [ ] Each filter returns only matching results
- [ ] Multiple filters can be combined

**Scenario 4C — No results**
- [ ] Prints a helpful hint instead of empty table

**Scenario 4D — List companies**
- [ ] Returns table: companyId, company name

---

## UC-05 · `wolf select`

```bash
wolf select
```

**Scenario 5A — Interactive TUI**
- [ ] Opens TUI with scored jobs sorted by score descending
- [ ] Shows company, title, score, status, JD URL (plain text)
- [ ] User can toggle selection; DB updates `selected` field immediately

**Scenario 5B — MCP flow**

In Claude Desktop, after `wolf_list` returns numbered results:

> "Select jobs 1, 3, and 5"

- [ ] AI maps numbers to jobIds and calls `wolf_select` with `{ jobIds: [...], action: "select" }`
- [ ] AI confirms selection to user
- [ ] Deselect: AI calls `wolf_select` with `action: "unselect"`

---

## UC-06 · `wolf tailor`

Place a `.tex` resume in the profile folder and ensure `profile.toml` has `resumePath` set.

```bash
wolf tailor
```

**Scenario 6A — Batch tailor all selected jobs**
- [ ] Reads all `selected: true` AND (`status: scored` OR `status: tailor_error`) jobs
- [ ] Submits batch to Claude Batch API; CLI prints progress
- [ ] Writes tailored `.tex` per job
- [ ] Compiles each `.tex` to PDF via `xelatex`
- [ ] Takes screenshots (1 JPG per page, max 2 pages)
- [ ] Sends screenshots + `.tex` to Claude for visual review
- [ ] On "return updated .tex" → recompiles (max 3 iterations total)
- [ ] On LGTM → continues to next job
- [ ] After 3 iterations: 1 page → accepted; 2 pages → `status: tailor_error`
- [ ] Prints summary: tailored, errors, output file paths

**Scenario 6B — Single job**
```bash
wolf tailor --jobid <jobId>
```
- [ ] Skips batch; synchronous call
- [ ] Same compile + review loop applies

**Scenario 6C — Diff flag**
```bash
wolf tailor --jobid <jobId> --diff
```
- [ ] Prints before/after comparison of every changed bullet point

**Scenario 6D — Cover letter flag**
```bash
wolf tailor --cover-letter
```
- [ ] After tailoring completes → runs UC-07 for all successfully tailored jobs

**Scenario 6E — xelatex not installed**
- [ ] Skips PDF compilation for all jobs, prints warning, continues to summary

**Scenario 6F — Malformed .tex from Claude**
- [ ] If response is not valid `.tex` → marks `status: tailor_error`, continues

**Scenario 6G — Compilation failure**
- [ ] Sends `.tex` + error log back to Claude to fix, retries
- [ ] If still fails → `status: tailor_error`

---

## UC-07 · `wolf cover-letter`

```bash
wolf cover-letter
wolf cover-letter --jobid <jobId>
```

**Scenario 7A — With company description**
- [ ] JD or `companies` table has company description
- [ ] Generated CL includes "why this company" section
- [ ] Saved as `.md` alongside tailored resume
- [ ] `evaluations.coverLetterPath` recorded
- [ ] Converted to PDF via `md-to-pdf`
- [ ] File paths printed

**Scenario 7B — Without company description**
- [ ] No company description in JD or DB
- [ ] CL focuses on user+job fit only; no "why this company" section; nothing hallucinated

**Scenario 7C — md-to-pdf not installed**
- [ ] Saves `.md` only, prints warning, continues cleanly

---

## UC-08 · `wolf fill`

> TODO: Design deferred.

---

## UC-09 · `wolf reach`

> TODO: Design deferred.

---

## UC-12 · `wolf env`

```bash
wolf env show
```

**Scenario 12A — Show**
- [ ] For each `WOLF_*` key: if set → prints masked value (first 4 + last 4 chars)
- [ ] If not set → prints key name marked as "not set"
- [ ] Full key value is never printed

```bash
wolf env clear
```

**Scenario 12B — Clear**
- [ ] Scans shell RC files for `WOLF_*` export lines
- [ ] Removes matching lines from RC file
- [ ] Prints `unset WOLF_<KEY>` commands for current session

**Scenario 12C — No RC file**
- [ ] Prints warning and exits without modifying any files

---

## UC-13 · End-to-End Agent Workflow (MCP)

In Claude Desktop with wolf MCP configured:

> "Find me some jobs, score them, and help me apply"

- [ ] AI calls `wolf_hunt` → reports N new jobs
- [ ] AI calls `wolf_score` → reports scores, highlights top matches
- [ ] AI calls `wolf_list` with score filter → presents numbered list to user
- [ ] User selects jobs → AI calls `wolf_select`
- [ ] AI calls `wolf_tailor` → returns PDF paths and change summary
- [ ] All MCP tool responses are structured JSON conforming to tool output schema

---

## Sample JDs

Located in `samples/jd/`. Use these to test different parsing scenarios:

| File | Format | Good for testing |
|---|---|---|
| `jd1_clean_bullets.txt` | Clean bullets | Baseline / happy path |
| `jd2_paragraphs.txt` | Paragraphs only | JD parsing with no structure |
| `jd3_mixed.txt` | Mixed | Most common real-world case |
| `jd4_minimal.txt` | Minimal | Very short JD edge case |
| `jd5_wall_of_text.txt` | Wall of text | Parsing robustness |
