# ADD-01 - Add One Structured Job

## Purpose

Verify that `wolf add` stores a structured job, returns a `jobId`, updates the
tracked count, and makes the job visible through `wolf job list`.

## Covers

- `UC-02.2.1`
- `AC-10-1` (CLI-equivalent `jobId` response shape)

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-01`.

## Setup

Run the dev build once for the group:

```bash
npm run build:dev
```

Create and initialize the workspace:

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-01 npm run wolf -- init --dev --empty
```

## Steps

Run:

```bash
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 119)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-01 npm run wolf -- add --title "Member of Technical Staff, Backend" --company "Fixture Company" --jd-text "$JD_TEXT" --url "https://jobs.example.test/fixture/backend?ref=wolf"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-01 npm run wolf -- status
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-01 npm run wolf -- job list --search "Fixture Company"
```

## Pass Criteria

- `init`, `add`, `status`, and `job list` exit `0`.
- Dev banner appears on stderr for every wolf invocation.
- `add` stdout is JSON containing a non-empty `jobId` string.
- `status` shows `tracked  1`.
- `job list --search "Fixture Company"` shows `Fixture Company` and `Member of Technical Staff, Backend`.
- No runtime files are written under `~/wolf`, `~/wolf-dev`, or repo-local
  `data/` (ignore the tracked `data/.gitkeep` placeholder).

## Report Requirements

Write the group report under
`/tmp/wolf-test/acceptance/<run-id>/reports/add/report.md`. Include:

- commands and exit codes
- stdout/stderr log paths
- returned `jobId`
- fixture path, source row id, and fixture source policy reference
- `status` evidence
- `job list` evidence
- protected-path safety check
- result: `PASS`, `FAIL`, `SKIPPED`, or `BLOCKED`
