# Wolf Smoke Test Suite

Smoke tests are the fast gate for wolf. Run them after ordinary CLI changes and
before handing a branch to review.

Smoke verifies:

- the dev build compiles
- `wolf init --dev --empty` can create isolated workspaces
- core read/write CLI paths do not crash
- safety rules are followed
- each group writes a durable report

Smoke does not attempt full use-case coverage. That belongs in
`test/acceptance/`.

## How To Run

Copy this prompt to Claude Code or another agent runner:

```text
You are the Wolf Smoke Test Orchestrator.

1. Read test/README.md and test/smoke/README.md.
2. Run in the agent runner's normal execution mode. Use the least interactive
   path available: batch safe commands when allowed, request approval only when
   the runner requires it, continue after approval, and do not stop after
   returning only a plan.
3. Create a run id like smoke-YYYYMMDD-HHMMSS.
4. Ensure /tmp/wolf-test/smoke/<run-id>/workspaces/ and
   test/runs/<run-id>/reports/ exist. Do not delete them yet.
5. Identify every group folder under test/smoke/groups/.
6. Dispatch one sub-agent per group in parallel.
7. Each group agent must:
   a. cd /Users/guanyutao/developers/personal-projects/wolf
   b. run npm run build:dev once for the group
   c. execute the group's README.md cases in order
   d. use WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/<workspace-id>
      for every wolf invocation
   e. write test/runs/<run-id>/reports/<group-id>/report.md
   f. capture stdout, stderr, and exit code for every command
   g. if approval is denied or unavailable, write a BLOCKED report instead of
      returning only a plan
8. After all groups report, print per-group and overall PASS/FAIL/SKIPPED/BLOCKED
   counts, write test/runs/<run-id>/report.md, and update test/runs/LATEST.md.
9. Do not delete /tmp/wolf-test/smoke/<run-id>/ or test/runs/<run-id>/ unless
   the user explicitly asks.
```

## Groups

| Group | Purpose | Execution Mode | Cost |
|---|---|---|---|
| `bootstrap` | Dev init and workspace isolation | automated | free |
| `read-commands` | Empty-workspace read commands | automated | free |
| `config` | Config get/set roundtrip | automated | free |
| `profile` | Default profile bootstrap | automated | free |
| `env` | Environment key display safety | automated | free |
| `job-workflows` | Add/status/list job workflow | automated | free |

## Report Addendum

In addition to the global report contract, smoke reports must include:

- whether the dev banner appeared for each wolf invocation
- the exact `WOLF_DEV_HOME` path used by each case
- a safety check confirming no files were written to `~/wolf`, `~/wolf-dev`, or
  repo-local `data/`
