# ADD-02 - JD Description Persistence

## Purpose

Verify that `wolf add` persists the job description into the canonical job
record and exposes it through the data-governed `wolf job` read surface.

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
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- init --preset empty
```

## Steps

Run:

```bash
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 291)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- add --title "Data Scientist" --company "Fixture Company" --jd-text "$JD_TEXT"
```

Extract `jobId` from stdout. Then inspect the canonical job fields:

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- job get <jobId> description_md
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- job show <jobId> --json
```

Also verify the workspace does not rely on a stale `data/jobs/**/jd.md`
artifact:

```bash
find /tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02/data/jobs -name jd.md -print
```

## Pass Criteria

- `init` and `add` exit `0`.
- `add` stdout contains a non-empty `jobId`.
- `job get <jobId> description_md` exits `0` and contains `Data Scientist`.
- `job show <jobId> --json` exits `0` and includes the same description in its
  JSON payload.
- The stale `find ... -name jd.md` check prints nothing; the JD source of truth
  is the job record, not a legacy markdown sidecar file.
- No runtime files are written under `~/wolf`, `~/wolf-dev`, or repo-local
  `data/` (ignore the tracked `data/.gitkeep` placeholder).

## Report Requirements

Include the fixture path, source row id, returned `jobId`, a short
`description_md` excerpt from `wolf job get`, the `job show --json` evidence,
the legacy `jd.md` absence check, and the protected-path safety check.
