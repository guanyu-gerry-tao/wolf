# Acceptance Group: Fill

## Status

Planned.

## Product Area

Application form analysis, dry-run mapping, fixture-page filling, screenshot
capture, status updates, and live submit boundaries.

## Coverage Target

- `UC-08.1.1`
- `UC-08.1.2`
- `AC-06-1`
- `AC-06-2`
- `AC-06-3`
- `AC-06-4`
- `AC-06-5`

## Execution Mode

- Fixture dry-run and local fixture page: `automated` or `ai-reviewed`.
- Real website submission: `human-approval` and `skipped-by-default`.

## Human Approval Guidance

Live submit tests must stop before submitting a real application. The tester
must be shown the target URL, filled fields, attachments, expected result, edge
conditions, stop condition, and cleanup instructions before approving any
external side effect.

## Report Expectations

Reports must include form fixture path or URL, field mapping, screenshot path,
whether submission was blocked or approved, and any browser errors.

