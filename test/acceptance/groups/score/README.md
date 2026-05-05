# Acceptance Group: Score

## Status

Implemented.

## Product Area

Tier-based job triage against a profile via Claude Batch API and synchronous
Haiku. AI emits one of four tiers (`skip` / `mass_apply` / `tailor` /
`invest`) plus pros/cons markdown. Covers the `wolf score` CLI surface plus
the `POST /api/score` HTTP route. Filtering ("dealbreakers") was removed in
v3 — downstream commands decide thresholds based on tier; see DECISIONS.md
(2026-05-04). User overrides via `wolf job set tier ...` are not exercised
here (separate group / future).

## Coverage Target

- `UC-03.1.1`
- `UC-03.1.2`
- `AC-03-1`
- `AC-03-2`
- `AC-03-3`
- `AC-03-4`

## Execution Mode

Mixed. Cases SCORE-AC01 and SCORE-AC02 are `automated` and use the dev-only
`WOLF_TEST_AI_RESPONSE_FILE` env-var hook to inject canned AI responses — they
are deterministic and run on every PR. SCORE-AC03 is `ai-reviewed`, paid, and
skipped by default; only run it when the user explicitly authorizes the spend.

## Cost / Risk

- SCORE-AC01 / SCORE-AC02: free (no network, no API key needed beyond the dummy one set by the dev binary).
- SCORE-AC03: medium (one Anthropic call per fixture job × 3 fixtures × 2 personas = 6 calls).
- Risk: SCORE-AC03 requires `WOLF_ANTHROPIC_API_KEY` or `WOLF_DEV_ANTHROPIC_API_KEY`. Missing keys are FAIL on opt-in, SKIP otherwise.

## Cases

- [SCORE-AC01 - Single mode writes tier_ai + scoreJustification](SCORE-AC01-single-mocked.md)
- [SCORE-AC02 - Malformed AI response is recorded as score_error](SCORE-AC02-malformed-response.md)
- [SCORE-AC03 - Live AI tier verdict quality (paid, opt-in)](SCORE-AC03-quality-live.md)

## AI Review Rubric

Only SCORE-AC03 is `ai-reviewed`. Use
`test/acceptance/reviewers/score-artifact-review.md` for the tier band sanity
and justification quality checks.

## Report Expectations

Reports must include the input JD fixture id, the profile persona, the
resolved `Job.tierAi` (integer index) + `Job.scoreJustification` (markdown)
from the SQLite DB, and any `error` / `status` flips. For SCORE-AC03 also
include reviewer findings.
