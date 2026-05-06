# Smoke Group: Bootstrap

## Purpose

Verify that a dev build can create an isolated, schema-valid workspace without
interactive prompts. This group is the prerequisite for most other smoke and
acceptance groups.

## Coverage

- `AC-01-5`
- `AC-01-6`

## Case B-01 - `wolf init --preset empty` creates a valid dev workspace

**Execution mode:** automated
**Cost:** free
**Workspace id:** `bootstrap-B01`

### Goal

Confirm the non-interactive dev init path writes the expected skeleton files,
marks the workspace as dev, and does not touch real user workspaces.

### Steps

Use:

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/bootstrap-B01 npm run wolf -- init --preset empty
```

### Pass Criteria

- Exit code is `0`.
- Dev banner appears on stderr.
- `wolf.toml` exists under the test workspace.
- `profiles/default/profile.toml` exists under the test workspace.
- `profiles/default/attachments/README.md` exists under the test workspace.
- `profiles/default/score.md` exists under the test workspace.
- `data/` exists under the test workspace.
- `data/wolf.sqlite` does not exist after init.
- `wolf.toml` contains `[instance]` and `mode = "dev"`.
- `wolf.toml` contains `default = "default"` (the profile-folder pointer).
- No files were created under `~/wolf`, `~/wolf-dev`, or repo-local runtime
  paths under `data/`; ignore the tracked placeholder `data/.gitkeep`.

### Report Requirements

Record the command, exit code, stdout path, stderr path, file existence checks,
the `wolf.toml` excerpt proving dev mode, the `data/wolf.sqlite` absence check,
and the safety check result.

## Case B-02 - `wolf init --preset default` creates a dev demo profile

**Execution mode:** automated
**Cost:** free
**Workspace id:** `bootstrap-B02`

### Goal

Confirm the dev-only preset path writes a populated default profile for demos
and acceptance debugging, while leaving job search storage blank.

### Steps

Use:

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/bootstrap-B02 npm run wolf -- init --preset default
```

### Pass Criteria

- Exit code is `0`.
- Dev banner appears on stderr.
- `wolf.toml` contains `[instance]` and `mode = "dev"`.
- `profiles/default/profile.toml` contains the default preset identity,
  resume entries, projects, education, skills, and builtin question answers.
- `data/` exists under the test workspace.
- `data/wolf.sqlite` does not exist after init, proving the preset did not
  seed SQLite job/search records.

### Report Requirements

Record the command, exit code, stdout path, stderr path, the `wolf.toml`
excerpt proving dev mode, profile excerpts proving preset content, the
`data/wolf.sqlite` absence check.
