# JOB-02 - JSON Output And Overflow Footer

## Purpose

Verify machine-readable output and visible overflow behavior for `wolf job list`.

## Covers

- `AC-08-8`
- `AC-08-10`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02`.

## Setup

```bash
npm run build:dev
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- add --title "Role One" --company "Acme" --jd-text "One"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- add --title "Role Two" --company "Acme" --jd-text "Two"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- add --title "Role Three" --company "Acme" --jd-text "Three"
```

## Steps

Run:

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- job list --limit 2
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- job list --json
```

## Pass Criteria

- All commands exit `0`.
- `--limit 2` output shows exactly two rows and a footer indicating one more
  matching row.
- `--json` stdout parses as JSON.
- JSON contains a `jobs` array with three entries.
- JSON contains `totalMatching` and `limited` fields.
- Dev banner appears on stderr for every wolf invocation.
- No runtime files are written under `~/wolf`, `~/wolf-dev`, or repo-local
  `data/` (ignore the tracked `data/.gitkeep` placeholder).

## Report Requirements

Include the table output, footer line, parsed JSON summary, exit codes, and
safety checks.
