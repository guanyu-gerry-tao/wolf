# Smoke Group: Score

## Purpose

Pin the deterministic, no-AI surface of `wolf score`: help text, CLI flag
parsing, missing-API-key error, missing-profile error, and the empty `--poll`
no-op. AI-backed paths (live scoring, batch submit, batch poll with results)
are exercised in the acceptance group `score` instead.

## Case S-01 - `wolf score --help` lists every flag

**Execution mode:** automated
**Cost:** free
**Workspace id:** `score-S01`

### Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S01 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S01 npm run wolf -- score --help
```

### Pass Criteria

- Both commands exit `0`.
- `wolf score --help` stdout includes `--profile`, `--jobs`, `--single`, `--poll`, and `--ai-model`.
- The `[NOT YET IMPLEMENTED — M2]` tag does NOT appear in the description (score is now available).

## Case S-02 - `wolf score --single` fails fast when API key is missing

**Execution mode:** automated
**Cost:** free
**Workspace id:** `score-S02`

### Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S02 npm run wolf -- init --dev --empty
# Explicitly clear both forms of the key for the score invocation only:
( unset WOLF_DEV_ANTHROPIC_API_KEY WOLF_ANTHROPIC_API_KEY \
  && WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S02 npm run wolf -- score --single ) ; echo "exit=$?"
```

### Pass Criteria

- Score invocation exits non-zero (`exit=1`).
- stderr mentions `WOLF_ANTHROPIC_API_KEY` and points at `wolf-dev env set` (or `wolf env set` for stable).
- No network calls are made (the binary returns before any AI dispatch).

## Case S-03 - `wolf score --profile <missing>` errors cleanly

**Execution mode:** automated
**Cost:** free
**Workspace id:** `score-S03`

### Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S03 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S03 npm run wolf -- score --profile does-not-exist --single ; echo "exit=$?"
```

### Pass Criteria

- Exit code is non-zero.
- stderr or stdout contains `does-not-exist` and surfaces "profile" wording so the user knows which input is wrong.

## Case S-04 - `wolf score --poll` on an empty workspace is a clean no-op

**Execution mode:** automated
**Cost:** free
**Workspace id:** `score-S04`

### Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S04 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S04 npm run wolf -- score --poll
```

### Pass Criteria

- Both commands exit `0`.
- `score --poll` stdout includes `Polled 0 batches`.
- No AI / network call is made (no API key required for `--poll`).

## Report Requirements

Record one stdout/stderr line per case as evidence. For S-02 also record the
exact `WOLF_*` env-var name in the error message so any future rename to
`WOLF_ANTHROPIC_KEY` (etc.) is caught.
