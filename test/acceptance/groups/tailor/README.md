# Acceptance Group: Tailor

## Status

Implemented.

## Product Area

Resume tailoring, cover-letter generation, generated artifacts, PDF screenshots,
and AI review of output quality.

## Coverage Target

- `UC-06.1.1`
- `UC-06.1.2`
- `UC-07.1.1`
- `UC-07.1.2`
- `AC-04-1`
- `AC-04-2`
- `AC-04-3`
- `AC-04-4`
- `AC-05-1`
- `AC-05-2`
- `AC-05-3`

## Execution Mode

`ai-reviewed`. Human review is optional, not the default executor.

## Cost / Risk

- Cost: medium to high
- Risk: external-api
- Requires: `WOLF_ANTHROPIC_API_KEY` or `WOLF_DEV_ANTHROPIC_API_KEY`; future
  OpenAI-compatible providers are acceptable if configured through wolf config.
- Missing required API credentials are `FAIL`, not `SKIPPED`. The report must
  name the missing key and tell the user how to configure it.

## Cases

- [TAILOR-01 - Full tailor pipeline for one fixture job](TAILOR-01-full-pipeline.md)
- [TAILOR-02 - Stepwise brief, resume, and cover letter](TAILOR-02-stepwise-pipeline.md)
- [TAILOR-03 - Analyst hint is written and used](TAILOR-03-hint-guidance.md)
- [TAILOR-04 - Section honesty and pool-driven ordering](TAILOR-04-section-honesty.md)

## AI Review Rubric

Use `test/acceptance/reviewers/tailor-artifact-review.md`. The reviewer must
inspect source resume facts, JD facts, generated resume, cover letter, and PDF
screenshot evidence. The review must judge factual accuracy, JD relevance,
unsupported claims, formatting, one-page behavior, and specific fixes for
failures.

## Report Expectations

Reports must include artifact paths, screenshots or screenshot paths, reviewer
findings, bugs, and improvements.
