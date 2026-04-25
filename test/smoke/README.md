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
2. Create a run id like smoke-YYYYMMDD-HHMMSS.
3. Ensure /tmp/wolf-test/smoke/<run-id>/workspaces/ and
   test/runs/<run-id>/reports/ exist. Do not delete them yet.
4. Identify every group folder under test/smoke/groups/.
5. Dispatch one sub-agent per group in parallel.
6. Each group agent must:
   a. cd /Users/guanyutao/developers/personal-projects/wolf
   b. run npm run build:dev once for the group
   c. execute the group's README.md cases in order
   d. use WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/<workspace-id>
      for every wolf invocation
   e. write test/runs/<run-id>/reports/<group-id>/report.md
   f. capture stdout, stderr, and exit code for every command
7. After all groups report, print per-group and overall PASS/FAIL/SKIPPED/BLOCKED
   counts, write test/runs/<run-id>/report.md, and update test/runs/LATEST.md.
8. Do not delete /tmp/wolf-test/smoke/<run-id>/ or test/runs/<run-id>/ unless
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
