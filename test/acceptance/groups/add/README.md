# Acceptance Group: Add

## Status

Implemented.

## Product Area

Manual job intake through `wolf add`: structured job storage, company creation,
JD file persistence, and downstream visibility through `wolf status` and
`wolf job list`.

## Coverage Target

- `UC-02.2.1`
- `UC-02.2.2` (CLI-equivalent storage behavior only; MCP remains planned)
- `AC-10-1` (CLI-equivalent `jobId` shape only; MCP remains planned)

## Execution Mode

`automated`.

## Cases

- [ADD-01 - Add one structured job](ADD-01-one-structured-job.md)
- [ADD-02 - Add writes JD to the job workspace](ADD-02-jd-file-persistence.md)

## Report Expectations

Reports must include the returned `jobId`, command stdout/stderr logs, workspace
paths, JD file evidence, status/list evidence, and any bugs or improvements.

