# Smoke Group: Env

## Purpose

Verify that environment status display is safe and does not leak secrets.

## Coverage

- `AC-09-1`
- `AC-09-2`

## Case E-01 - `wolf env show` with no keys set

**Execution mode:** automated  
**Cost:** free  
**Workspace id:** `env-E01`

### Steps

```bash
env -u WOLF_ANTHROPIC_API_KEY -u WOLF_APIFY_API_TOKEN -u WOLF_GMAIL_CLIENT_ID -u WOLF_GMAIL_CLIENT_SECRET WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/env-E01 npm run wolf -- env show
```

Do not run `wolf env clear`.

### Pass Criteria

- Command exits `0`.
- stdout marks each key as not set.
- stdout does not contain any secret values.
- Dev banner appears on stderr.

## Report Requirements

Record the redacted stdout evidence. Do not include real secret values in the
report.

