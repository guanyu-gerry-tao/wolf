# SCORE-AC03 - Live AI Scoring Quality (Paid, Opt-In)

## Purpose

Sanity check that the production scoring prompt can produce a persisted,
reviewable tier verdict with a grounded explanation for several real fixture
JDs. This is the only case in the group that calls the live Claude API; it is
paid and skipped by default.

## Covers

- `UC-03.1.1` (single-job score, live)
- Indirectly: prompt output quality and explanation grounding.

## Execution Mode

`ai-reviewed`. Skipped by default. Run only when the user explicitly
authorizes the spend.

## Cost / Risk

- Cost: medium (3 Sonnet calls per persona × 2 personas = 6 calls).
- Risk: external-api.
- Requires: `WOLF_ANTHROPIC_API_KEY` or `WOLF_DEV_ANTHROPIC_API_KEY`.

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC03`.

## Setup

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC03
WOLF_DEV_HOME="$WS" npm run wolf -- init --preset empty
bash test/fixtures/wolf-profile/scripts/populate_v2_profile.sh ng-swe "$WS"
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
# Three fixture JDs with different fit profiles: Software Engineer,
# System Administrator, and Product Designer. Update the row ids if the CSV
# changes.
for ROW in 523 172 288; do
  JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id "$ROW")"
  TITLE="Fixture Job $ROW"
  WOLF_DEV_HOME="$WS" npm run wolf -- add --title "$TITLE" --company "Fixture Co" --jd-text "$JD_TEXT"
done
```

## Steps

For each tracked job, run synchronous scoring and capture the output:

```bash
WOLF_DEV_HOME="$WS" npm run wolf -- job list --status new --limit 50
# For each id:
WOLF_DEV_HOME="$WS" npm run wolf -- score --single --jobs "<JOB_ID>"
```

Repeat the entire flow with the `swe-mid` persona (a separate workspace
recommended) so the reviewer can compare whether the explanations account for
the active persona.

## AI Review Rubric

Use [`../../reviewers/score-artifact-review.md`](../../reviewers/score-artifact-review.md).

### Case-specific checks

- Each scored job has a persisted `Job.tierAi` value corresponding to one of
  `skip`, `mass_apply`, `tailor`, or `invest`.
- Each scored job has a non-empty `Job.scoreJustification` with `## Tier`,
  `## Pros`, and `## Cons` sections.
- The justification should be grounded in the JD and persona: it must cite
  concrete signals such as role, stack, salary, location, remote preference,
  sponsorship, or explicit profile preferences.
- The reviewer may accept any tier if the explanation makes a reasonable case
  for that tier. For example, a relevant SWE job may still be `mass_apply` if
  the explanation names real friction such as missing salary, unclear
  sponsorship, off-stack technologies, or logistics mismatch.
- A run should fail only when the tier is empty/invalid, the explanation is
  missing or generic, the explanation fabricates facts, or the verdict is
  clearly unreasonable (for example, a non-engineering JD promoted to a high
  tier without a concrete justification).

## Pass Criteria

- All wolf commands exit `0`.
- Every scored job persists a valid tier and a grounded explanation.
- Reviewer result is `PASS` or `PASS_WITH_MINOR_IMPROVEMENTS`.

## Report Requirements

Include each `Job.tierAi` + `Job.scoreJustification`, the persona name, the
JD row id, and the AI reviewer's findings.
