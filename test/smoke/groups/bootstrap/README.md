# Smoke Group: Bootstrap

## Purpose

Verify that a dev build can create an isolated, schema-valid workspace without
interactive prompts. This group is the prerequisite for most other smoke and
acceptance groups.

## Coverage

- `AC-01-5`
- `AC-01-6`

## Case B-01 - `wolf init --dev --empty` creates a valid dev workspace

**Execution mode:** automated  
**Cost:** free  
**Workspace id:** `bootstrap-B01`

### Goal

Confirm the non-interactive dev init path writes the expected skeleton files,
marks the workspace as dev, and does not touch real user workspaces.

### Steps

Use:

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/bootstrap-B01 npm run wolf -- init --dev --empty
```

### Pass Criteria

- Exit code is `0`.
- Dev banner appears on stderr.
- `wolf.toml` exists under the test workspace.
- `profiles/default/profile.md` exists under the test workspace.
- `profiles/default/standard_questions.md` exists under the test workspace.
- `profiles/default/resume_pool.md` exists under the test workspace.
- `profiles/default/attachments/README.md` exists under the test workspace.
- `data/` exists under the test workspace.
- `wolf.toml` contains `[instance]` and `mode = "dev"`.
- `wolf.toml` contains `default = "default"` (the profile-folder pointer).
- No files were created under `~/wolf`, `~/wolf-dev`, or repo-local `data/`.

### Report Requirements

Record the command, exit code, stdout path, stderr path, file existence checks,
the `wolf.toml` excerpt proving dev mode, and the safety check result.

