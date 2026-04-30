# Acceptance Group: Job Data Governance

## Status

Implemented. This group owns the post-β.10h `wolf job` row-governance surface:
schema discovery, row reads, typed writes, salary range convention, and
system-managed field protections.

## Product Area

`wolf job show / get / set / fields`.

## Coverage Target

- `AC-12-1`
- `AC-12-2`
- `AC-12-3`
- `AC-12-4`
- `AC-12-5`
- `AC-12-6`

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
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-<case-id>
```

Cases may seed jobs with `wolf add` and a fixture JD. Store the returned
`jobId` in the report before exercising `wolf job show/get/set/fields`.

## Cases

- [JOB-GOV-01 - Fields reference and row reads](JOB-GOV-01-fields-and-reads.md)
- [JOB-GOV-02 - Editable field writes](JOB-GOV-02-editable-writes.md)
- [JOB-GOV-03 - Salary zero-plus-range convention](JOB-GOV-03-salary-convention.md)
- [JOB-GOV-04 - Invalid job writes are rejected](JOB-GOV-04-invalid-writes.md)
- [JOB-GOV-05 - System-managed fields are read-only](JOB-GOV-05-system-managed.md)

## Report Expectations

Reports must include command lines, exit codes, stdout/stderr log paths,
workspace path, returned `jobId`, field values before/after writes, validation
error excerpts, and a protected-path safety check showing no runtime files were
written under `~/wolf`, `~/wolf-dev`, or repo-local `data/` (ignore the tracked
`data/.gitkeep` placeholder).
