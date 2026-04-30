# JOB-GOV-01 - Fields Reference and Row Reads

## Purpose

Verify that `wolf job fields` is driven by `JOB_FIELDS`, and that `show`/`get`
read both flat columns and JD prose.

## Covers

- `AC-12-1`
- `AC-12-2`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01`.

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- init --dev --empty
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 119)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- add --title "Backend Fixture Engineer" --company "Fixture Company" --jd-text "$JD_TEXT" --url "https://jobs.example.test/job-gov-01"
```

Record the returned `jobId` as `<job-id>`.

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job fields
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job fields --required
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job fields --json
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job fields salaryLow
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job show <job-id>
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job show <job-id> --json
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job get <job-id> title
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job get <job-id> description_md
```

## Pass Criteria

- Every command exits `0`.
- `job fields` includes editable fields such as `title`, `salaryLow`, `salaryHigh`, and `description_md`.
- `job fields --required` omits optional fields such as `scoreJustification`.
- `job fields --json` parses as JSON and contains rows with `name`, `type`, `required`, and `help`.
- `job show` includes `Backend Fixture Engineer`, `Fixture Company`, system-managed fields, and a `--- description_md ---` section.
- `job show --json` parses as JSON and includes `fields`, `descriptionMd`, and `companyName`.
- `job get title` prints only `Backend Fixture Engineer`.
- `job get description_md` prints the seeded JD prose.
