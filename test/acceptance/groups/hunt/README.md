# Acceptance Group: Hunt

## Status

Planned. This group is intentionally separate from `fill`, `score`, and
`tailor`.

## Product Area

Job discovery providers, provider failure isolation, URL normalization, dedupe,
and hunt summary output.

## Coverage Target

- `UC-02.1.1`
- `UC-02.1.2`
- `AC-02-1`
- `AC-02-2`
- `AC-02-3`
- `AC-02-4`

## Execution Mode

- Default: `automated` with mock or fixture providers.
- Optional: `skipped-by-default` for live external providers.

## Report Expectations

Reports must include provider inputs, fetched rows, duplicates skipped, saved
rows, errors by provider, and the final CLI or MCP summary.

