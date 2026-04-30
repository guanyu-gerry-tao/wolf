# JOB-GOV-05 - System-Managed Fields Are Read-Only

## Purpose

Verify system-managed job fields are visible for inspection but rejected by
`wolf job set`.

## Covers

- `AC-12-6`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05`.

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- add --title "System Fields Fixture" --company "Fixture Company" --jd-text "JD text" --url "https://jobs.example.test/job-gov-05"
```

Record the returned `jobId` as `<job-id>`.

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job show <job-id>
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job get <job-id> id
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job get <job-id> companyId
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job get <job-id> createdAt
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job get <job-id> updatedAt
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job set <job-id> id rewritten
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job set <job-id> createdAt 2026-04-30T00:00:00.000Z
```

## Pass Criteria

- `job show` exits `0` and includes `id`, `companyId`, `createdAt`, and `updatedAt`.
- `job get` for each system-managed field exits `0` and prints a non-empty value.
- `job set id` exits non-zero and says the field is system-managed.
- `job set createdAt` exits non-zero and says the field is system-managed.
