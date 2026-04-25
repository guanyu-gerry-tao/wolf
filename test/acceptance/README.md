# Wolf Acceptance Test Suite

Acceptance tests are the coverage gate for implemented wolf behavior. They
should answer: "Which use cases and acceptance criteria are actually exercised
by runnable tests?"

Acceptance is broader than smoke and may include API calls, AI artifact review,
browser automation, or human approval boundaries. Costly or risky groups are
skipped by default.

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
4. Ensure /tmp/wolf-test/acceptance/<run-id>/workspaces/ and
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
   e. write test/runs/<run-id>/reports/<group-id>/report.md
   f. capture stdout, stderr, exit code, generated artifact paths, bugs, and
      improvements
   g. if approval is denied or unavailable, write a BLOCKED report instead of
      returning only a plan
9. After all groups report, print per-group and overall PASS/FAIL/SKIPPED/BLOCKED
   counts, write test/runs/<run-id>/report.md, update test/runs/LATEST.md, and
   include a coverage summary by UC/AC id.
10. Do not delete /tmp/wolf-test/acceptance/<run-id>/ or test/runs/<run-id>/
   unless the user explicitly asks.
```

## Group Index

| Group | Product Area | Default Mode | Default Status |
|---|---|---|---|
| `hunt` | Job discovery providers and dedupe | automated / ai-reviewed | planned |
| `score` | Job scoring and hard filters | ai-reviewed | planned |
| `job-tracking` | Rich `wolf job list` filters and output modes | automated | planned |
| `tailor` | Resume and cover-letter artifact generation | ai-reviewed | planned |
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
