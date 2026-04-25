# Acceptance Group: Score

## Status

Planned.

## Product Area

Job scoring, dealbreaker filters, structured score output, malformed AI response
handling, and single-job scoring.

## Coverage Target

- `UC-03.1.1`
- `UC-03.1.2`
- `AC-03-1`
- `AC-03-2`
- `AC-03-3`
- `AC-03-4`

## Execution Mode

`ai-reviewed` by default. Use deterministic fixture jobs and ask the reviewer to
verify score shape, filter decisions, and justification quality. Live model calls
are `skipped-by-default` unless explicitly allowed.

## Report Expectations

Reports must include input jobs, profile facts used for filtering, model or mock
response evidence, DB updates, score summaries, and reviewer findings.

