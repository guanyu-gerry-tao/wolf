# Smoke Group: Serve

## Purpose

Verify that the dev build can start the local `wolf serve` HTTP daemon and
answer the companion extension's ping request.

## Coverage

- `wolf serve --port`
- `GET /api/ping`

## Case SERVE-01 - `wolf serve` answers `/api/ping`

**Execution mode:** automated  
**Cost:** free  
**Workspace id:** `serve-SERVE01`

### Goal

Confirm `wolf serve` binds only to localhost, prints the listening URL, and
echoes the ping nonce expected by the Chrome side panel.

### Steps

Use:

```bash
export WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/serve-SERVE01
npm run wolf -- init --dev --empty
npm run wolf -- serve --port 49152 > /tmp/wolf-test/smoke/<run-id>/reports/serve/logs/serve.stdout 2> /tmp/wolf-test/smoke/<run-id>/reports/serve/logs/serve.stderr &
SERVER_PID=$!
sleep 1
curl -sS "http://127.0.0.1:49152/api/ping?nonce=serve-smoke"
kill $SERVER_PID
```

### Pass Criteria

- `wolf init --dev --empty` exits `0`.
- `wolf serve --port 49152` starts and prints
  `wolf serve listening on http://127.0.0.1:49152`.
- `curl` exits `0`.
- The JSON response includes `"nonce":"serve-smoke"`.
- The JSON response includes a non-empty `serverTime` and `version`.
- No files were created under `~/wolf`, `~/wolf-dev`, or repo-local runtime
  paths under `data/`; ignore the tracked placeholder `data/.gitkeep`.

### Report Requirements

Record the init command, serve command, curl command, exit codes, stdout/stderr
log paths, JSON response, and the safety check result.
