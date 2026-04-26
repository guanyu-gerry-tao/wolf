# Wolf Acceptance Test Suite

Acceptance tests are the coverage gate for implemented wolf behavior. They
should answer: "Which use cases and acceptance criteria are actually exercised
by runnable tests?"

Acceptance is broader than smoke and may include API calls, AI artifact review,
browser automation, or human approval boundaries. Groups are skipped by default
only when their docs explicitly mark them that way; otherwise missing
prerequisites are reported as failures or blocked runs.

## How To Run

Copy this prompt to Claude Code or another agent runner:

```text
You are the Wolf Acceptance Test Orchestrator.

1. Read test/README.md and test/acceptance/README.md.
2. Run in the agent runner's normal execution mode. Use the least interactive
   path available: batch safe commands when allowed, request approval only when
   the runner requires it, continue after approval, and do not stop after
   returning only a plan.
3. Create a run id like acceptance-YYYYMMDD-HHMMSS.
4. Ensure /tmp/wolf-test/acceptance/<run-id>/workspaces/,
   /tmp/wolf-test/acceptance/<run-id>/reports/, and
   test/runs/<run-id>/reports/ exist. Do not delete them yet.
5. Identify every group folder under test/acceptance/groups/.
6. Skip groups marked skipped-by-default unless the user explicitly allows the
   required cost or risk.
7. Dispatch one sub-agent per runnable group in parallel.
8. Each group agent must:
   a. cd /Users/guanyutao/developers/personal-projects/wolf
   b. run npm run build:dev once for the group
   c. execute the group's README.md cases in order
   d. use WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/<workspace-id>
      for every wolf invocation
   e. write /tmp/wolf-test/acceptance/<run-id>/reports/<group-id>/report.md
   f. write command logs and lightweight artifact indexes under
      /tmp/wolf-test/acceptance/<run-id>/reports/<group-id>/
   g. capture stdout, stderr, exit code, generated artifact paths, bugs, and
      improvements
   h. return the report.md path in the final message
   i. if approval is denied or unavailable, return a BLOCKED summary instead of
      returning only a plan
9. After all groups report, copy /tmp/wolf-test/acceptance/<run-id>/reports/
   into test/runs/<run-id>/reports/.
10. Inspect each group report for required report sections. If a report is
   missing important evidence, ask that group agent to continue and complete the
   report. If the group agent is unavailable and the missing evidence is
   important for judging the result, rerun that group. Do not silently accept an
   incomplete report. A report that says SKIPPED because a required `WOLF_*` API
   key was not set must be re-classified as FAIL per the External API Policy
   below — name the missing key and what to configure.
11. Print per-group and overall PASS/FAIL/SKIPPED/BLOCKED counts, write
   test/runs/<run-id>/report.md, update test/runs/LATEST.md, and include a
   coverage summary by UC/AC id.
12. Do not delete /tmp/wolf-test/acceptance/<run-id>/ or test/runs/<run-id>/
   unless the user explicitly asks.
```

## Group Index

| Group | Product Area | Default Mode | Default Status |
|---|---|---|---|
| `add` | Manual structured job intake | automated | implemented |
| `hunt` | Job discovery providers and dedupe | automated / ai-reviewed | planned |
| `score` | Job scoring and hard filters | ai-reviewed | planned |
| `job-tracking` | Rich `wolf job list` filters and output modes | automated | implemented |
| `tailor` | Resume and cover-letter artifact generation | ai-reviewed | implemented |
| `fill` | Application form filling | automated for fixtures, human-approval for live submit | planned |
| `reach` | Outreach draft and send boundaries | ai-reviewed / human-approval | planned |
| `mcp-contract` | MCP tool schemas and structured responses | automated | planned |

## Coverage Rules

Each group README must include:

- the covered `UC-*` and `AC-*` ids
- explicit execution mode
- cost and risk labels
- run prerequisites
- case steps
- pass/fail rubric
- artifact review rubric when mode is `ai-reviewed`
- human guidance when mode is `human-guided` or `human-approval`

If a use case is implemented but has no acceptance group, the suite should say
so explicitly rather than hiding the gap.

The coverage matrix lives in [COVERAGE.md](COVERAGE.md). Update it whenever a
case is added, removed, planned, implemented, or re-scoped.

## AI Review Policy

Use AI review for subjective artifacts whenever possible. For example,
`tailor` should generate a resume or cover letter, then ask an AI reviewer to
inspect:

- factual accuracy against the source resume pool
- JD relevance
- formatting and PDF screenshots
- unsupported claims
- concrete fixes for any failures

The reviewer output must be written into the group report. Human review may be
offered as an optional follow-up, but should not be the default test executor.

For tailor artifacts, use the shared reviewer prompt at
`test/acceptance/reviewers/tailor-artifact-review.md`, then add case-specific
checks from the case file.

## External API Policy

If a runnable implemented group requires an external API key, missing credentials
are a `FAIL`, not a skip. The report must name the missing key, explain which
case could not run, and tell the user what to configure. Use `SKIPPED` only when
the group or case is explicitly marked skipped-by-default or the user explicitly
chooses not to run that risk/cost class.

External API reports must record provider, model if known, relevant `WOLF_*`
key presence as `set`/`not set`, and any cost or rate-limit observations.

## Real Side Effects

Real side effects require `human-approval` and must never happen by accident.
Examples include:

- submitting a real job application
- clicking a final submit button on a live ATS or employer form
- sending outreach email or LinkedIn messages
- modifying external accounts, CRM records, calendars, or mailboxes
- uploading a real resume or cover letter to a live third-party site

Fixture pages, local browser automation, dry-run form mapping, generated
screenshots, and local file writes under `/tmp/wolf-test/` are not real external
side effects.

## Short-Term Plan

1. Keep the fixture scripts as the default source for realistic pasted JD and
   resume inputs.
2. Keep the orchestrator responsible for report completeness. Do not add a
   report checker script yet.
3. Use the shared tailor reviewer prompt for all tailor AI review cases.
4. Keep `COVERAGE.md` current as cases move between planned and implemented.
5. Treat missing required API credentials in runnable implemented groups as
   `FAIL` with clear user-facing remediation.
