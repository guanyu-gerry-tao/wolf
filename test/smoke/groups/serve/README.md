# Smoke Group: Serve

## Purpose

Verify that the dev build can start the local `wolf serve` HTTP daemon and
answer the companion extension's ping request.

## Coverage

- `wolf serve --port`
- `GET /api/ping`
- `GET /api/runtime/status`
- `POST /api/inbox/items`
- `POST /api/inbox/process`
- `GET /api/runs/:runId`
- Companion extension reload and manual import path
- Structured TODO responses for unfinished companion services
- Safe Stagehand placeholder behavior for no-auto-submit fill

## Case SERVE-01 - `wolf serve` answers `/api/ping`

**Execution mode:** automated  
**Cost:** free  
**Workspace id:** `serve-SERVE01`

### Goal

Confirm `wolf serve` binds only to localhost, prints the listening URL, and
echoes the ping nonce expected by the Chrome side panel.

### Steps

Use two terminal sessions. Session 1 is intentionally blocked by `wolf serve`;
keep it open while testing the extension. Session 2 reads the env file and runs
curl / sqlite checks against the same temporary workspace.

Session 1:

```bash
cd <repo-worktree>
npm run build:dev

RUN_ID=manual-$(date +%s)
export WOLF_DEV_HOME=/tmp/wolf-test/smoke/$RUN_ID/workspaces/serve-SERVE01
export WOLF_SERVE_PORT=49152
export WOLF_TEST_ENV_FILE=/tmp/wolf-latest-serve-env.sh

mkdir -p "$WOLF_DEV_HOME"
cat > "$WOLF_TEST_ENV_FILE" <<EOF
export WOLF_DEV_HOME="$WOLF_DEV_HOME"
export WOLF_SERVE_PORT="$WOLF_SERVE_PORT"
EOF

echo "Session 2 should run: source $WOLF_TEST_ENV_FILE"
npm run wolf -- init --dev --empty
npm run wolf -- serve --port "$WOLF_SERVE_PORT"
```

Session 2:

```bash
cd <repo-worktree>
source /tmp/wolf-latest-serve-env.sh

curl -sS "http://127.0.0.1:$WOLF_SERVE_PORT/api/ping?nonce=serve-smoke"
curl -sS "http://127.0.0.1:$WOLF_SERVE_PORT/api/runtime/status"

curl -sS -X POST "http://127.0.0.1:$WOLF_SERVE_PORT/api/inbox/items" \
  -H "content-type: application/json" \
  -d '{"kind":"manual_page","source":"wolf_companion","title":"Test Role A","url":"https://example.com/jobs/a","html":"<html><body>Build A.</body></html>","capturedAt":"2026-05-01T00:00:00.000Z"}'

curl -sS -X POST "http://127.0.0.1:$WOLF_SERVE_PORT/api/inbox/items" \
  -H "content-type: application/json" \
  -d '{"kind":"manual_page","source":"wolf_companion","title":"Test Role B","url":"https://example.com/jobs/b","html":"<html><body>Build B.</body></html>","capturedAt":"2026-05-01T00:00:00.000Z"}'

curl -sS -X POST "http://127.0.0.1:$WOLF_SERVE_PORT/api/inbox/process" \
  -H "content-type: application/json" \
  -d '{"limit":20,"shardSize":20}'

sqlite3 "$WOLF_DEV_HOME/data/wolf.sqlite" \
  'select id, kind, source, status, title, url from inbox_items order by received_at;
   select id, title, url, status from jobs order by created_at;
   select id, type, status, created_at from background_ai_batches order by created_at;
   select id, background_ai_batch_id, provider, status, item_count, provider_batch_id from background_ai_batch_shards order by id;
   select subject_id, status, substr(ai_input_json, 1, 120) as input_preview from background_ai_batch_items order by id;'
```

### Pass Criteria

- `wolf init --dev --empty` exits `0`.
- `wolf serve --port 49152` starts and prints
  `wolf serve listening on http://127.0.0.1:49152`.
- `curl` exits `0`.
- The JSON response includes `"nonce":"serve-smoke"`.
- The JSON response includes a non-empty `serverTime` and `version`.
- Session 1 prints the `USER PLEASE READ` port block and tells the user to
  keep the terminal open.
- `/api/runtime/status` returns browser status `ready` after the default
  browser launch succeeds. If Session 1 uses `--no-browser`, it may return
  `not_started` and the companion should show the wolf-browser overlay.
- Two manual inbox items are written to SQLite.
- `POST /api/inbox/process` returns `202` with `status:"completed"` and
  `jobIds`, or `status:"empty"` if the inbox was already processed.
- SQLite shows promoted inbox rows and matching `jobs` rows after processing
  non-empty raw inbox items. Background AI batch rows may be absent in the
  local no-provider MVP path.
- Unimplemented companion endpoints return structured
  `{ "status": "todo", "todo": "...", "nextStep": "..." }` rather than 404.
- Autofill remains no-auto-submit. Any fill endpoint or UI copy must state
  that wolf fills the page but does not submit the application.
- No files were created under `~/wolf`, `~/wolf-dev`, or repo-local runtime
  paths under `data/`; ignore the tracked placeholder `data/.gitkeep`.

### Extension Reload Check

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked` and select `<repo-worktree>/extension`.
4. If already loaded, click `Update`.
5. Open the side panel named `wolf companion`.
6. Copy the port printed by Session 1 into the port field and click
   `Reconnect`.
7. Import two simple job pages. Activity should report successful imports or
   duplicate detection.
8. Click `Process Inbox`; confirm the prompt; verify promoted inbox rows and
   job rows from Session 2.

### TODO Endpoint Check

Use one genuinely unfinished endpoint to confirm stable TODO behavior. Pick a
route that still maps to `todoRoute` in `nodeHttpServerImpl.ts` (grep
`Run listing is not implemented yet`); `GET /api/runs` has been the canonical
TODO route since serve landed.

```bash
curl -sS "http://127.0.0.1:$WOLF_SERVE_PORT/api/runs"
```

Expected: HTTP `501` with body shape `{"status":"todo","todo":"...","nextStep":"..."}`
where `nextStep` names the missing application/service method.

Note: `POST /api/artifacts/regenerate` was the earlier canonical TODO check
but is now wired to `companionActionApp.regenerateArtifact` and returns
`202`. Update this section if `/api/runs` ever gets implemented; pick
another route still matched by `todoRouteSpec`.

### Report Requirements

Record the init command, serve command, curl command, exit codes, stdout/stderr
log paths if redirected, JSON responses, extension reload result, import result,
SQLite query output, TODO endpoint response, and the safety check result.
