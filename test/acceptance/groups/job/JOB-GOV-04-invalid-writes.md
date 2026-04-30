# JOB-GOV-04 - Invalid Job Writes Are Rejected

## Purpose

Verify `wolf job set` rejects invalid values and leaves the prior row value
unchanged.

## Covers

- `AC-12-5`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04`.

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- add --title "Invalid Write Fixture" --company "Fixture Company" --jd-text "JD text" --url "https://jobs.example.test/job-gov-04"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> status new
```

Record the returned `jobId` as `<job-id>`.

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> nope value
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> status bogus
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> remote maybe
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> score not-a-number
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> salaryLow unpaid
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job get <job-id> status
```

## Pass Criteria

- Unknown field `nope` exits non-zero and suggests `job fields`.
- Invalid enum `status bogus` exits non-zero and lists or names valid values.
- Invalid boolean `remote maybe` exits non-zero.
- Invalid number `score not-a-number` exits non-zero.
- Removed sentinel `salaryLow unpaid` exits non-zero and says the value must be numeric.
- Final `job get status` still prints `new`.
