# Score Feature Handoff

## Status

Implemented for the current tier-based scoring scope.

`wolf score` can score tracked jobs against the active profile, persist an AI
tier verdict, and store a reviewable markdown explanation. The feature is
covered by unit tests, smoke tests, and the score acceptance group. SCORE-AC03
is a paid live-AI quality check; its acceptance standard is that live scoring
returns a valid tier plus a grounded explanation, not that a fixture must map
to one exact tier.

## User Surface

- `wolf score` submits every unscored job to the async AI Batch API.
- `wolf score --poll` drains completed score batches and writes results back to
  job rows.
- `wolf score --single --jobs <JOB_ID>` runs one synchronous live score and
  prints the canonical markdown verdict.
- `wolf job set <JOB_ID> tier <tier>` sets a user override. AI scoring writes
  `tierAi`; user overrides write `tierUser`.
- `wolf job list --tier <tiers>` filters by the effective tier:
  `tierUser ?? tierAi`.

Valid tiers are `skip`, `mass_apply`, `tailor`, and `invest`.

## Data Contract

Scoring writes these `Job` fields:

- `tierAi`: nullable integer index into `TIER_NAMES`.
- `scoreJustification`: markdown with `## Tier`, `## Pros`, and `## Cons`.
- `status: error` and `error: score_error` when provider or parse failures
  occur.

Scoring must not write `tierUser`. User overrides remain separate so a later AI
run cannot erase the user's judgment.

## Implementation Map

- CLI: `src/cli/commands/score.ts`
- Application orchestration:
  `src/application/impl/scoreApplicationServiceImpl.ts`
- Service contract: `src/service/scoringService.ts`
- Prompt and parser: `src/service/impl/scoringServiceImpl.ts` and
  `src/service/impl/prompts/score-system.md`
- Tier names and indexes: `src/utils/scoringTiers.ts`
- Job fields and filters: `src/utils/jobFields.ts`,
  `src/repository/jobRepository.ts`, and its implementations

The application service owns write-back and batch polling. The scoring service
only builds or runs AI scoring requests and returns parsed verdicts.

## AI Contract

The model is expected to emit:

```xml
<tier>skip | mass_apply | tailor | invest</tier>
<pros>...</pros>
<cons>...</cons>
```

The parser converts that response into the stored markdown explanation. Invalid
or missing tags are treated as score extraction errors rather than silently
writing a default tier.

## Acceptance

- SCORE-AC01: mocked single-score write-back.
- SCORE-AC02: malformed AI response handling.
- SCORE-AC03: opt-in paid live-AI quality review.

The current SCORE-AC03 standard is intentionally review-based: a result passes
when each live score has a valid tier and an explanation that is specific,
grounded in the JD/profile, and not hallucinated. Prompt preference debates,
such as whether a friction-heavy SWE role should be `mass_apply` or `tailor`,
belong in prompt tuning rather than as hard acceptance failures.

## Handoff Notes

- Do not reintroduce dealbreaker filtering into score. Downstream commands
  decide thresholds from tier.
- Keep AI and user tiers separate: `tierAi` is produced by scoring, `tierUser`
  is a manual override.
- If a future prompt change changes tier behavior, update SCORE-AC03 only when
  the acceptance boundary itself changes.
- SCORE-AC03 costs money and needs `WOLF_ANTHROPIC_API_KEY` or
  `WOLF_DEV_ANTHROPIC_API_KEY`; missing keys are FAIL only when the user
  explicitly opted into paid AC.
