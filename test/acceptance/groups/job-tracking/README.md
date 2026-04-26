# Acceptance Group: Job Tracking

## Status

Implemented. Smoke covers only a narrow happy path; this group owns full list
and status behavior.

## Product Area

`wolf status` and `wolf job list`, including structured filters, repeatable
search, time ranges, JSON output, overflow footer, and invalid input.

## Coverage Target

- `AC-08-1`
- `AC-08-2`
- `AC-08-3`
- `AC-08-4`
- `AC-08-5`
- `AC-08-6`
- `AC-08-6b`
- `AC-08-6c`
- `AC-08-7`
- `AC-08-8`
- `AC-08-9`
- `AC-08-10`
- `AC-08-11`
- `AC-08-12`

## Execution Mode

`automated`.

## Cases

- [JOB-01 - Structured filters and repeated search](JOB-01-filters-and-search.md)
- [JOB-02 - JSON output and overflow footer](JOB-02-json-and-overflow.md)
- [JOB-03 - Invalid input is rejected](JOB-03-invalid-input.md)

## Report Expectations

Reports must include seeded jobs, command output, JSON output when applicable,
expected/actual row ids for filters, and clear bug entries for invalid-input
behavior.
