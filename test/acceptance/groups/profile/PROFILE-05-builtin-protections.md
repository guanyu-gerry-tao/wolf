# PROFILE-05 - Builtin Question Protections

## Purpose

Verify wolf-builtin questions can be answered but cannot have protected
metadata changed or be removed.

## Covers

- `AC-11-7`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05`.

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- init --preset empty
```

Pick one builtin question id from `profile show` and record it in the report.
The runner may use the first `[[question]]` block whose `required = true`.

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile show
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile set question.<builtin-id>.answer "I can answer this builtin safely."
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile set question.<builtin-id>.prompt "Rewrite protected prompt"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile set question.<builtin-id>.required false
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile remove question <builtin-id> --yes
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile get question.<builtin-id>.answer
```

## Pass Criteria

- Setting the builtin `answer` exits `0`.
- Setting builtin `prompt` exits non-zero and stderr says the prompt cannot be changed.
- Setting builtin `required` exits non-zero and stderr says the required flag cannot be changed.
- Removing the builtin question exits non-zero and stderr says builtin questions cannot be removed.
- The answer value still reads back after rejected metadata changes.
