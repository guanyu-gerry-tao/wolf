# SCORE-AC02 - Malformed AI Response Becomes score_error

## Purpose

Verify that when the AI emits a response that doesn't conform to the
`<tier>...</tier><pros>...</pros><cons>...</cons>` contract, the
synchronous `--single` path surfaces a clean error to the user without
silently writing a default tier.

## Covers

- `UC-03.1.2` (score error semantics)
- `AC-03-3` (error visibility)
- `AC-03-4` (no silent fallback score)

## Execution Mode

`automated`

## Cost / Risk

- Cost: free
- Risk: low

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC02`.

## Setup

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC02
WOLF_DEV_HOME="$WS" npm run wolf -- init --preset empty
bash test/fixtures/wolf-profile/scripts/populate_v2_profile.sh ng-swe "$WS"
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 119)"
ADD_OUT=$(WOLF_DEV_HOME="$WS" npm run wolf -- add --title "Backend Engineer" --company "Fixture Co" --jd-text "$JD_TEXT")
JOB_ID=$(echo "$ADD_OUT" | python3 -c 'import sys,json,re;raw=sys.stdin.read();m=re.search(r"\\{[\\s\\S]*\\}",raw);print(json.loads(m.group(0))["jobId"])')

mkdir -p "$WS/test-fixtures/score"
# Malformed: no <tier> tag at all.
cat > "$WS/test-fixtures/score/single-bad.txt" <<'EOF'
I cannot help with that request.
EOF
```

## Steps

```bash
WOLF_TEST_AI_RESPONSE_FILE="$WS/test-fixtures/score/single-bad.txt" \
  WOLF_DEV_HOME="$WS" npm run wolf -- score --single --jobs "$JOB_ID" ; echo "exit=$?"
```

## Pass Criteria

- The `score` invocation exits non-zero (`exit=1`).
- stderr (or stdout) contains the word `parse` (or `score`) so the user
  understands the issue.
- `wolf job show <JOB_ID>` reports `tierAi:` blank (no silent default written).
  Note: this case is `--single`, which surfaces parse failure as a thrown
  error — the Job row is left untouched. The poll path's "mark as
  score_error" semantics are exercised by the unit tests
  (`scoreApplicationService.test.ts`).

## Report Requirements

Include the exit code, the error message printed, and the `wolf job show`
output before and after.
