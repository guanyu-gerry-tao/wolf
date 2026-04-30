# Acceptance Group: Profile Data Governance

## Status

Implemented. This group owns the CLI data-governance surface for
`profile.toml`: schema discovery, surgical reads/writes, array entries, custom
questions, builtin protections, and validation failures.

## Product Area

`wolf profile show / get / set / fields / add / remove`.

## Coverage Target

- `AC-11-1`
- `AC-11-2`
- `AC-11-3`
- `AC-11-4`
- `AC-11-5`
- `AC-11-6`
- `AC-11-7`
- `AC-11-8`

## Execution Mode

`automated`.

## Cost / Risk

- Cost: free
- Risk: writes-temp

## Prerequisites

Run the dev build once for the group:

```bash
npm run build:dev
```

Every case must use a workspace under:

```text
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-<case-id>
```

## Cases

- [PROFILE-01 - Fields reference and raw reads](PROFILE-01-fields-and-reads.md)
- [PROFILE-02 - Scalar and multiline field writes](PROFILE-02-field-writes.md)
- [PROFILE-03 - Resume entry lifecycle](PROFILE-03-entry-lifecycle.md)
- [PROFILE-04 - Custom question lifecycle](PROFILE-04-question-lifecycle.md)
- [PROFILE-05 - Builtin question protections](PROFILE-05-builtin-protections.md)
- [PROFILE-06 - Invalid profile writes are rejected](PROFILE-06-invalid-writes.md)

## Report Expectations

Reports must include command lines, exit codes, stdout/stderr log paths,
workspace path, relevant `profile.toml` excerpts before/after writes, returned
entry ids, validation error excerpts, and a protected-path safety check showing
no runtime files were written under `~/wolf`, `~/wolf-dev`, or repo-local
`data/` (ignore the tracked `data/.gitkeep` placeholder).
