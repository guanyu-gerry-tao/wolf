# PROFILE-04 - Custom Question Lifecycle

## Purpose

Verify the β.10g `wolf profile add question --prompt --answer` surface and
custom question removal.

## Covers

- `AC-11-6`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04`.

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- init --dev --empty
```

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile add question --id custom-open-source --prompt "Describe your open source work." --answer "I maintain fixture tools for realistic CLI tests."
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile get question.custom-open-source.prompt
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile get question.custom-open-source.answer
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile get question.custom-open-source.required
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile remove question custom-open-source --yes
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile show
```

## Pass Criteria

- `profile add question` exits `0` and prints `Added question.custom-open-source`.
- Prompt and answer read back exactly.
- `question.custom-open-source.required` reads back as `false`.
- Removing the custom question exits `0`.
- Final `profile show` does not contain `custom-open-source`.
