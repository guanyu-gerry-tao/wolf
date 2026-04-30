# JOB-01 - Structured Filters And Repeated Search

## Purpose

Verify that `wolf job list` combines repeated `--search` terms with OR and
structured filters with AND.

## Covers

- `AC-08-3`
- `AC-08-4`
- `AC-08-5`
- `AC-08-6`
- `AC-08-6b`
- `AC-08-9`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01`.

## Setup

```bash
npm run build:dev
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- add --title "Backend Engineer" --company "Acme" --jd-text "Build TypeScript APIs."
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- add --title "Frontend Engineer" --company "Acme" --jd-text "Build React UI."
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- add --title "Data Engineer" --company "Northstar" --jd-text "Build data pipelines."
```

## Steps

Run:

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- job list
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- job list --search Backend
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- job list --search Backend --search Northstar
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- job list --search Acme --status new
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- job list --search Missing
```

## Pass Criteria

- All setup and list commands exit `0`.
- Default `job list` shows all three jobs.
- `--search Backend` shows `Backend Engineer` and does not show `Frontend Engineer`.
- Repeated search shows `Backend Engineer` and `Northstar`.
- `--search Acme --status new` shows both Acme jobs.
- Missing search prints `No jobs match.`
- Dev banner appears on stderr for every wolf invocation.
- No runtime files are written under `~/wolf`, `~/wolf-dev`, or repo-local
  `data/` (ignore the tracked `data/.gitkeep` placeholder).

## Report Requirements

Include setup commands, all list outputs, expected/actual visible job titles,
exit codes, and safety checks.
