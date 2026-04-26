# Acceptance Group: Reach

## Status

Planned - not implemented.

## Product Area

Outreach draft generation, inferred contact handling, Gmail send boundaries, and
outreach logging.

## Coverage Target

- `UC-09.1.1`
- `UC-09.1.2`
- `AC-07-1`
- `AC-07-2`
- `AC-07-3`
- `AC-07-4`

## Execution Mode

- Draft-only: `ai-reviewed`.
- Real email send: `human-approval` and `skipped-by-default`.

## Human Approval Guidance

Send tests must stop before sending an email. The tester must see recipient,
subject, body, inferred email confidence, expected result, edge conditions, stop
condition, and cleanup instructions.

## Report Expectations

Reports must include draft paths, reviewer findings, send boundary evidence,
and any outreach log evidence when sending is explicitly approved.
