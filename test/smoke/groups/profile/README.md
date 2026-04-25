# Smoke Group: Profile

## Purpose

Verify that init creates an active default profile.

## Case P-01 - `wolf profile list` shows the default profile

**Execution mode:** automated  
**Cost:** free  
**Workspace id:** `profile-P01`

### Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/profile-P01 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/profile-P01 npm run wolf -- profile list
```

### Pass Criteria

- Both commands exit `0`.
- stdout contains a `default` profile line marked with `*`.
- Dev banner appears on stderr for each wolf invocation.

## Report Requirements

Record the profile list output line used as evidence.

