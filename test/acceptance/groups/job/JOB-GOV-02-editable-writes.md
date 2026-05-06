# JOB-GOV-02 - Editable Field Writes

## Purpose

Verify typed updates for editable job fields, including `--from-file` for JD
prose.

## Covers

- `AC-12-3`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02`.

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- add --title "Governance Test Role" --company "Fixture Company" --jd-text "Original JD text" --url "https://jobs.example.test/job-gov-02"
mkdir -p /tmp/wolf-test/acceptance/<run-id>/inputs
printf 'Updated JD line one\nUpdated JD line two\n' > /tmp/wolf-test/acceptance/<run-id>/inputs/job-description.md
```

Record the returned `jobId` as `<job-id>`.

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job set <job-id> status applied
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job get <job-id> status
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job set <job-id> score 0.82
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job get <job-id> score
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job set <job-id> remote true
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job get <job-id> remote
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job set <job-id> description_md --from-file /tmp/wolf-test/acceptance/<run-id>/inputs/job-description.md
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job get <job-id> description_md
```

## Pass Criteria

- Every command exits `0`.
- `status` reads back as `applied`.
- `score` reads back as `0.82` or an equivalent numeric string.
- `remote` reads back as `true`.
- `description_md` reads back with both updated JD lines and no extra phantom blank line.
