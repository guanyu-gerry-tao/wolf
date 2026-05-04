# PROFILE-06 - Invalid Profile Writes Are Rejected

## Purpose

Verify profile validation failures are user-facing and non-destructive.

## Covers

- `AC-11-8`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06`.

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile set contact.email before@example.test
```

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile set contact.nope value
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile add nope --id bad
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile remove experience missing-id
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile set contact.email
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile get contact.email
```

## Pass Criteria

- Invalid `set contact.nope` exits non-zero and suggests `profile fields`.
- Invalid `add nope` exits non-zero and lists allowed types.
- `remove experience missing-id` without `--yes` exits non-zero and shows the safer `--yes` command.
- Missing value for `profile set contact.email` exits non-zero and names `--from-file`.
- Final `profile get contact.email` still prints `before@example.test`.
