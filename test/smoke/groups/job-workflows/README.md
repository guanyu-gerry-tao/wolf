# Smoke Group: Job Workflows

## Purpose

Verify that the basic job tracking workflow can write a job, update dashboard
counts, and list matching jobs from the same workspace.

## Coverage

- `UC-02.2.1`
- `AC-08-1`
- `AC-08-3`
- `AC-08-5`
- `AC-08-9`

## Case J-01 - add -> status -> list happy path

**Execution mode:** automated  
**Cost:** free  
**Workspace id:** `jobs-J01`

### Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J01 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J01 npm run wolf -- add --title "Backend Engineer" --company "Acme" --jd-text "Build APIs in TypeScript."
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J01 npm run wolf -- status
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J01 npm run wolf -- job list --search Acme
```

### Pass Criteria

- All commands exit `0`.
- `add` returns JSON with `jobId`.
- `status` shows `tracked  1`.
- `job list` shows `Acme` and `Backend Engineer`.
- Dev banner appears on stderr for each wolf invocation.

## Case J-02 - multiple jobs search behavior

**Execution mode:** automated  
**Cost:** free  
**Workspace id:** `jobs-J02`

### Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J02 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J02 npm run wolf -- add --title "Frontend Engineer" --company "Acme" --jd-text "React UI work."
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J02 npm run wolf -- add --title "Platform Engineer" --company "Acme" --jd-text "Internal platform work."
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J02 npm run wolf -- job list --search Acme
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J02 npm run wolf -- job list --search Other
```

### Pass Criteria

- All commands exit `0`.
- The `Acme` search shows both jobs.
- The `Other` search prints `No jobs match.`
- Dev banner appears on stderr for each wolf invocation.

## Report Requirements

Record the returned job ids, status evidence, matching list output, and empty
state output.

