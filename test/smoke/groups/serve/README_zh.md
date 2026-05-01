# Smoke Group: Serve

## 目的

验证 dev build 可以启动本地 `wolf serve` HTTP daemon,并响应 companion
extension 使用的 ping 请求。

## 覆盖

- `wolf serve --port`
- `GET /api/ping`

## Case SERVE-01 - `wolf serve` 响应 `/api/ping`

**执行模式:** automated  
**成本:** free  
**Workspace id:** `serve-SERVE01`

### 目标

确认 `wolf serve` 只绑定 localhost,打印监听 URL,并 echo Chrome side panel
预期的 ping nonce。

### 步骤

使用:

```bash
export WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/serve-SERVE01
npm run wolf -- init --dev --empty
npm run wolf -- serve --port 49152 > /tmp/wolf-test/smoke/<run-id>/reports/serve/logs/serve.stdout 2> /tmp/wolf-test/smoke/<run-id>/reports/serve/logs/serve.stderr &
SERVER_PID=$!
sleep 1
curl -sS "http://127.0.0.1:49152/api/ping?nonce=serve-smoke"
kill $SERVER_PID
```

### 通过标准

- `wolf init --dev --empty` 退出码为 `0`。
- `wolf serve --port 49152` 能启动并打印
  `wolf serve listening on http://127.0.0.1:49152`。
- `curl` 退出码为 `0`。
- JSON 响应包含 `"nonce":"serve-smoke"`。
- JSON 响应包含非空的 `serverTime` 和 `version`。
- 没有文件写入 `~/wolf`、`~/wolf-dev` 或 repo-local runtime `data/`
  路径；被跟踪的 `data/.gitkeep` 占位文件忽略。

### 报告要求

记录 init command、serve command、curl command、退出码、stdout/stderr log
路径、JSON 响应和安全检查结果。
