# Smoke Group: Read Commands

## Purpose

Verify that basic read-only commands behave cleanly on empty workspaces.

## Coverage

- `AC-08-1`
- `AC-08-9`

## Case R-01 - `wolf status` on an empty workspace

**Execution mode:** automated  
**Cost:** free  
**Workspace id:** `read-R01`

### Goal

Confirm the dashboard prints the registered counters at zero instead of
crashing or returning partial output.

### Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/read-R01 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/read-R01 npm run wolf -- status
```

### Pass Criteria

- Both commands exit `0`.
- `status` stdout contains `tracked`, `tailored`, and `applied`.
- Each counter is `0`.
- Dev banner appears on stderr for each wolf invocation.

## Case R-02 - `wolf job list --search "%"` on an empty workspace

**Execution mode:** automated  
**Cost:** free  
**Workspace id:** `read-R02`

### Goal

Confirm an empty workspace returns a friendly empty state for a wildcard-looking
search term rather than a SQL error.

### Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/read-R02 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/read-R02 npm run wolf -- job list --search "%"
```

### Pass Criteria

- Both commands exit `0`.
- `job list` stdout contains `No jobs match.`
- Dev banner appears on stderr for each wolf invocation.

## Report Requirements

Record each command with stdout/stderr paths, exit code, and the specific output
lines used as evidence.

