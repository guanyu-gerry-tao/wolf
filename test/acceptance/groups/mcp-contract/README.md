# Acceptance Group: MCP Contract

## Status

Planned. MCP remains planned as an acceptance surface even though a few tool
handlers already exist; do not treat this group as runnable until MCP contract
cases are written.

## Product Area

MCP tool schemas, structured responses, error responses, dev tool naming, and
agent-facing contracts.

## Coverage Target

- `UC-01.1.2`
- `UC-02.1.2`
- `UC-02.2.2`
- `UC-03.1.2`
- `UC-06.1.2`
- `UC-07.1.2`
- `UC-08.1.2`
- `UC-09.1.2`
- `UC-13`
- `AC-10-1`
- `AC-10-2`
- `AC-10-3`

## Execution Mode

`automated` for schema and tool-shape checks. Tool calls with external side
effects inherit the relevant product group's risk mode.

## Report Expectations

Reports must include tool names, input payloads, output schema validation,
structured error evidence, and any dev-mode warning fields.
