# PROFILE-02 - Scalar and Multiline Field Writes

## Purpose

Verify that `wolf profile set` surgically updates scalar and multiline fields,
including `--from-file`.

## Covers

- `AC-11-3`
- `AC-11-4`

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02`.

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- init --dev --empty
mkdir -p /tmp/wolf-test/acceptance/<run-id>/inputs
printf 'Line one\nLine two\n' > /tmp/wolf-test/acceptance/<run-id>/inputs/profile-note.txt
```

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- profile set contact.email ada@example.test
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- profile get contact.email
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- profile set resume.note --from-file /tmp/wolf-test/acceptance/<run-id>/inputs/profile-note.txt
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- profile get resume.note
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- profile show
```

## Pass Criteria

- All successful commands exit `0`.
- `profile set contact.email` confirms `set contact.email`.
- `profile get contact.email` prints `ada@example.test`.
- `profile get resume.note` prints both `Line one` and `Line two`.
- The stored multiline value does not include an extra blank line caused by a phantom trailing newline.
- `profile show` still contains template comments around unrelated fields, proving the write was surgical.
