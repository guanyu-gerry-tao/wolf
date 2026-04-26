# JOB-03 - Invalid Input Is Rejected

## Purpose

Verify `wolf job list` rejects invalid input instead of silently returning an
empty result.

## Covers

- `AC-08-7`
- `AC-08-11`
- `AC-08-12`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03`.

## Setup

```bash
npm run build:dev
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03 npm run wolf -- init --dev --empty
```

## Steps

Run each command and capture exit code, stdout, and stderr:

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03 npm run wolf -- job list --status bogus
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03 npm run wolf -- job list --min-score abc
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03 npm run wolf -- job list --start not-a-date
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03 npm run wolf -- job list --limit 0
```

## Pass Criteria

- `init` exits `0`.
- Each invalid command exits non-zero.
- Each invalid command prints a clear error naming the offending flag or valid
  values.
- No invalid command silently prints `No jobs match.`
- Dev banner appears on stderr for every wolf invocation.
- No files are written under `~/wolf`, `~/wolf-dev`, or repo-local `data/`.

## Report Requirements

Include each invalid command, exit code, stderr excerpt, and whether the command
failed for the expected reason.

