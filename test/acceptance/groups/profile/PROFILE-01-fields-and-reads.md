# PROFILE-01 - Fields Reference and Raw Reads

## Purpose

Verify that profile schema discovery is driven by `PROFILE_FIELDS`, and that
raw/profile field reads are pipe-friendly.

## Covers

- `AC-11-1`
- `AC-11-2`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01`.

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile set identity.legal_first_name Ada
```

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile fields
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile fields --required
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile fields --json
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile fields identity.legal_first_name
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile show
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile get identity.legal_first_name
```

## Pass Criteria

- Every command exits `0`.
- `profile fields` includes `identity.legal_first_name`, `contact.email`, required/optional grouping, and help text.
- `profile fields --required` includes required fields and omits optional-only paths such as `resume.note`.
- `profile fields --json` parses as JSON and contains rows with `path`, `required`, `type`, and `help`.
- `profile fields identity.legal_first_name` prints only that path's metadata.
- `profile show` prints raw `profile.toml` content, including comments and `Ada`.
- `profile get identity.legal_first_name` prints exactly `Ada` plus a trailing newline.
