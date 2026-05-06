# Smoke Group: Serve

## 目的

验证 dev build 可以启动本地 `wolf serve` HTTP daemon,并响应 companion
extension 使用的 ping 请求。

## 覆盖

- `wolf serve --port`
- `GET /api/ping`
- `GET /api/runtime/status`
- `POST /api/inbox/items`
- `POST /api/inbox/process`
- `GET /api/runs/:runId`
- Companion extension reload 和手动 import 路径
- 已实现 companion action 的 queued run 响应
- 仍未完成 companion route 的结构化 TODO 响应
- no-auto-submit fill 的安全 Stagehand 占位行为

## Case SERVE-01 - `wolf serve` 响应 `/api/ping`

**执行模式:** automated  
**成本:** free  
**Workspace id:** `serve-SERVE01`

### 目标

确认 `wolf serve` 只绑定 localhost,打印监听 URL,并 echo Chrome side panel
预期的 ping nonce。

### 步骤

使用两个 terminal session。Session 1 会被 `wolf serve` 占住；测试 extension
期间保持它打开。Session 2 读取 env 文件,对同一个临时 workspace 执行 curl /
sqlite 检查。

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
npm run wolf -- init --preset empty
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

### 通过标准

- `wolf init --preset empty` 退出码为 `0`。
- `wolf serve --port 49152` 能启动并打印
  `wolf serve listening on http://127.0.0.1:49152` 到 stdout。
- `curl` 退出码为 `0`。
- JSON 响应包含 `"nonce":"serve-smoke"`。
- JSON 响应包含非空的 `serverTime` 和 `version`。
- Session 1 打印 `USER PLEASE READ` port block,并提示用户保持 terminal 打开。
- `/api/runtime/status` 在默认 browser launch 成功后返回 browser status
  `ready`。如果 Session 1 使用 `--no-browser`,则可以返回 `not_started`,
  companion 应显示 wolf browser overlay。
- 两个 manual inbox item 被写入 SQLite。
- 当 provider-backed inbox promotion 被排队时，`POST /api/inbox/process`
  返回 `202`，并带 `status:"queued"` 和 batch metadata；如果 inbox 已经处理过，
  可以返回 `status:"empty"`。
- 处理非空 raw inbox 后，SQLite 能看到 inbox rows 进入 `queued`。本地
  no-provider build 可以返回 `completed`，并直接创建 `jobs` rows；在某些 build
  里，provider-backed background batch tables 可能要等 worker/persistence 路径启用后才会有 rows。
- 未完成 companion endpoint 返回结构化
  `{ "status": "todo", "todo": "...", "nextStep": "..." }`,不能是 404。
- Autofill 保持 no-auto-submit。任何 fill endpoint 或 UI 文案都必须说明 wolf
  只填表,不会提交 application。
- 没有文件写入 `~/wolf`、`~/wolf-dev` 或 repo-local runtime `data/`
  路径；被跟踪的 `data/.gitkeep` 占位文件忽略。

### Extension Reload 检查

1. 打开 `chrome://extensions`。
2. 开启 Developer Mode。
3. 点击 `Load unpacked`,选择 `<repo-worktree>/extension`。
4. 如果已经加载过,点击 `Update`。
5. 打开名为 `wolf companion` 的 side panel。
6. 把 Session 1 打印的 port 复制到 port 输入框,点击 `Reconnect`。
7. Import 两个简单 job 页面。Activity 应报告 import 成功或 duplicate。
8. 点击 `Process Inbox`; 确认 prompt; 用 Session 2 查询 promoted inbox rows
   和 job rows。

### Queued Action Endpoint 检查

用一个已实现的 companion action endpoint 确认稳定 queued-run 行为：

```bash
curl -sS -X POST "http://127.0.0.1:$WOLF_SERVE_PORT/api/artifacts/regenerate" \
  -H "content-type: application/json" \
  -d '{"jobId":"job-1","artifactType":"resume","existingArtifactText":"","userPrompt":"tighten bullets"}'
```

预期：HTTP `200`，响应包含 `status:"queued"` 和 `runId`。

### TODO Endpoint 检查

用一个真正未完成的 endpoint 来确认稳定的 TODO 行为。挑一个仍然走
`nodeHttpServerImpl.ts` 中 `todoRoute` 的路由（grep
`Run listing is not implemented yet`）；自 serve 落地起 `GET /api/runs`
一直是规范的 TODO 路由。

```bash
curl -sS "http://127.0.0.1:$WOLF_SERVE_PORT/api/runs"
```

预期：HTTP `501`，响应包含 `status:"todo"` 和说明缺失 application/service
method 的 `nextStep`。

注意: 早期的 `POST /api/artifacts/regenerate` 已经接入
`companionActionApp.regenerateArtifact` 并返回 `202`,不再是 TODO。
如果未来 `/api/runs` 也实现了,请更新本节,从 `todoRouteSpec` 中再挑
一个仍未实现的路由。

### 报告要求

记录 init command、serve command、curl command、退出码、stdout/stderr log
路径（如果重定向了）、JSON 响应、extension reload 结果、import 结果、
SQLite 查询输出、queued action 响应、TODO endpoint 响应和安全检查结果。
