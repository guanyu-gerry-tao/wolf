# SCORE-AC03 - Live AI Scoring Quality (Paid, Opt-In)

## Purpose

Sanity check that the production scoring prompt produces score bands that
match human intuition for clear-fit and clear-mismatch JDs against two
distinct personas. This is the only case in the group that calls the live
Claude API; it is paid and skipped by default.

## Covers

- `UC-03.1.1` (single-job score, live)
- Indirectly: prompt quality, score-band rubric calibration.

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
WOLF_DEV_HOME="$WS" npm run wolf -- init --dev --empty
bash test/fixtures/wolf-profile/scripts/populate_v2_profile.sh ng-swe "$WS"
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
# Three JDs spanning the score band: pick row ids that are clearly aligned
# (backend SWE), borderline (DevOps adjacent), and mismatched (data analyst /
# non-engineering). Update the row ids if the CSV changes.
for ROW in 119 250 412; do
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
recommended) so the reviewer can compare how the same JDs score against two
distinct profiles.

## AI Review Rubric

Use [`../../reviewers/score-artifact-review.md`](../../reviewers/score-artifact-review.md).

### Case-specific checks

- The clearly-aligned backend JD scores ≥ 0.7 against `ng-swe`.
- The clearly-mismatched non-engineering JD scores ≤ 0.4 against `ng-swe`.
- The borderline JD scores between the two extremes; the justification
  should name the specific friction.
- The same JD set against `swe-mid` should score *differently* than `ng-swe`
  in at least one case (the persona shift must change at least one score
  band) — otherwise the prompt is ignoring the profile.
- No justification claims a profile fact that isn't in the persona's
  `profile.toml` (e.g. "candidate has 10 years of Kotlin experience" when
  the persona's resume_pool says nothing of the kind).

## Pass Criteria

- All wolf commands exit `0`.
- Score bands match the rubric above.
- Reviewer result is `PASS` or `PASS_WITH_MINOR_IMPROVEMENTS`.

## Report Requirements

Include each `Job.score` + `Job.scoreJustification`, the persona name, the
JD row id, and the AI reviewer's findings.
