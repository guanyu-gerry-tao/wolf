# ADD-02 - JD File Persistence

## Purpose

Verify that `wolf add` writes the job description to the job workspace on disk,
not only to SQLite.

## Covers

- `UC-02.2.1`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02`.

## Setup

```bash
npm run build:dev
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- init --dev --empty
```

## Steps

Run:

```bash
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 291)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- add --title "Data Scientist" --company "Fixture Company" --jd-text "$JD_TEXT"
```

Extract `jobId` from stdout. Then inspect the workspace:

```bash
find /tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02/data/jobs -name jd.md -print
```

Open the single `jd.md` found by `find`.

## Pass Criteria

- `init` and `add` exit `0`.
- `add` stdout contains a non-empty `jobId`.
- Exactly one `jd.md` exists under `data/jobs/`.
- `jd.md` contains `Data Scientist`.
- The job workspace directory name includes the company and title slug.
- No files are written under `~/wolf`, `~/wolf-dev`, or repo-local `data/`.

## Report Requirements

Include the fixture path, source row id, returned `jobId`, the `jd.md` path, a
short `jd.md` excerpt, and the protected-path safety check.
