# SCORE-AC01 - Single Mode Writes Back Parsed AI Score

## Purpose

Verify that `wolf score --single` runs the full pipeline (load profile, build
prompt, call AI, parse response, persist `Job.score` + `Job.scoreJustification`)
without any live network call. Uses the dev-only `WOLF_TEST_AI_RESPONSE_FILE`
hook to inject a canned `<score>0–10</score><justification>...</justification>`
response.

## Covers

- `UC-03.1.1` (single-job score)
- `AC-03-1` (score persisted to Job row)
- `AC-03-2` (justification persisted)

## Execution Mode

`automated`

## Cost / Risk

- Cost: free (no network calls)
- Risk: low

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC01`.

## Setup

Run the dev build once for the group:

```bash
npm run build:dev
```

Initialize the workspace and populate the NG-SWE persona:

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC01
WOLF_DEV_HOME="$WS" npm run wolf -- init --dev --empty
bash test/fixtures/wolf-profile/scripts/populate_v2_profile.sh ng-swe "$WS"
```

Add a fixture job and capture its id:

```bash
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 119)"
ADD_OUT=$(WOLF_DEV_HOME="$WS" npm run wolf -- add --title "Backend Engineer" --company "Fixture Co" --jd-text "$JD_TEXT")
JOB_ID=$(echo "$ADD_OUT" | python3 -c 'import sys,json,re;raw=sys.stdin.read();m=re.search(r"\\{[\\s\\S]*\\}",raw);print(json.loads(m.group(0))["jobId"])')
```

Stage the canned AI response under the run directory:

```bash
mkdir -p "$WS/test-fixtures/score"
cat > "$WS/test-fixtures/score/single-good.txt" <<'EOF'
<tier>tailor</tier>
<pros>
- Backend role aligned with target roles
- Sponsorship language matches profile
- Remote-friendly setup matches preference
</pros>
<cons>
- Tech stack mostly matches but cloud differs (GCP vs AWS)
</cons>
EOF
```

## Steps

```bash
WOLF_TEST_AI_RESPONSE_FILE="$WS/test-fixtures/score/single-good.txt" \
  WOLF_DEV_HOME="$WS" npm run wolf -- score --single --jobs "$JOB_ID"
```

## Expected Result

- Exit code `0`.
- stdout includes the canonical markdown blob: `## Tier\ntailor`, `## Pros\n- Backend role aligned`, `## Cons\n- Tech stack`.
- `wolf job show <JOB_ID>` reports `tierAi: 2` (the index of `tailor` in TIER_NAMES) and a non-null `scoreJustification` whose first line names the tier.

## Pass Criteria

- All setup commands and `score` exit `0`.
- Dev banner appears on stderr for every wolf invocation.
- The Job row has `tierAi = 2` and `scoreJustification` matches the
  canonical markdown shape (## Tier / ## Pros / ## Cons).
- `Job.tierUser` remains `null` — AI paths never write user overrides.
- No HTTP traffic to Anthropic occurred (verifiable by the absence of
  `ai.score.done` log entries with non-zero `durationMs > 0` AND the dev binary
  reading `WOLF_TEST_AI_RESPONSE_FILE`).

## Report Requirements

Include the resolved `JOB_ID`, the `wolf job show` JSON for that id, and the
contents of the canned response file used.
