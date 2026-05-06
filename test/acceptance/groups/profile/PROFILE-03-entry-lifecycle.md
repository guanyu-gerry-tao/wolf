# PROFILE-03 - Resume Entry Lifecycle

## Purpose

Verify add/edit/remove for resume-source array entries.

## Covers

- `AC-11-5`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03`.

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- init --preset empty
mkdir -p /tmp/wolf-test/acceptance/<run-id>/inputs
printf '%s\n' '- Built backend fixture service' '- Improved acceptance report quality' > /tmp/wolf-test/acceptance/<run-id>/inputs/experience-bullets.md
```

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile add experience --id acme-backend
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile set experience.acme-backend.company "Acme Systems"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile set experience.acme-backend.bullets --from-file /tmp/wolf-test/acceptance/<run-id>/inputs/experience-bullets.md
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile get experience.acme-backend.company
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile remove experience acme-backend --yes
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile show
```

## Pass Criteria

- `profile add experience --id acme-backend` exits `0` and prints `Added experience.acme-backend`.
- Setting `experience.acme-backend.company` exits `0`.
- Reading `experience.acme-backend.company` prints `Acme Systems`.
- Removing with `--yes` exits `0` and prints `Removed experience.acme-backend`.
- Final `profile show` no longer contains `id = "acme-backend"`.
