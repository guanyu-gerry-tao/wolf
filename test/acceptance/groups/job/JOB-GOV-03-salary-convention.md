# JOB-GOV-03 - Salary Zero-Plus-Range Convention

## Purpose

Verify the β.10j/k salary convention: `0` means explicitly unpaid, blank/null
means unknown, and `salaryLow=0` may coexist with a positive `salaryHigh`.

## Covers

- `AC-12-4`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03`.

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- add --title "Unpaid Base Plus Bonus" --company "Fixture Company" --jd-text "Unpaid base with potential bonus." --url "https://jobs.example.test/job-gov-03"
```

Record the returned `jobId` as `<job-id>`.

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job get <job-id> salaryLow
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job get <job-id> salaryHigh
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job set <job-id> salaryLow 0
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job set <job-id> salaryHigh 30000
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job get <job-id> salaryLow
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job get <job-id> salaryHigh
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job fields salaryLow
```

## Pass Criteria

- Initial salary fields read back as blank/unknown.
- `job set salaryLow 0` and `job set salaryHigh 30000` both exit `0`.
- `salaryLow` reads back exactly `0`.
- `salaryHigh` reads back exactly `30000`.
- `job fields salaryLow` documents that `0` means unpaid and blank means unknown.
