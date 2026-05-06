# 冒烟测试分组：Score

## 目的

锁定 `wolf score` 中不依赖 AI 的确定性入口：帮助文本、CLI 参数解析、缺失
API key 错误、缺失 profile 错误，以及 `--poll` 在空工作区的空操作。涉及
AI 的路径（在线打分、批量提交、批量轮询并写回结果）由验收测试分组 `score`
覆盖。

## Case S-01 - `wolf score --help` 列出所有参数

**执行方式：** automated
**成本：** free
**Workspace id：** `score-S01`

### 步骤

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S01 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S01 npm run wolf -- score --help
```

### 通过标准

- 两条命令均以 `0` 退出。
- `wolf score --help` 的 stdout 包含 `--profile`、`--jobs`、`--single`、`--poll`、`--ai-model`。
- 描述中不再出现 `[NOT YET IMPLEMENTED — M2]`（score 已正式可用）。

## Case S-02 - `wolf score --single` 在缺失 API key 时立即报错

**执行方式：** automated
**成本：** free
**Workspace id：** `score-S02`

### 步骤

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S02 npm run wolf -- init --preset empty
( unset WOLF_DEV_ANTHROPIC_API_KEY WOLF_ANTHROPIC_API_KEY \
  && WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S02 npm run wolf -- score --single ) ; echo "exit=$?"
```

### 通过标准

- score 调用以非 0 退出（`exit=1`）。
- stderr 提到 `WOLF_ANTHROPIC_API_KEY`，并提示 `wolf-dev env set`（或稳定版的 `wolf env set`）。
- 命令在任何 AI 调度之前就返回，没有任何网络请求。

## Case S-03 - `wolf score --profile <不存在>` 报错清晰

**执行方式：** automated
**成本：** free
**Workspace id：** `score-S03`

### 步骤

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S03 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S03 npm run wolf -- score --profile does-not-exist --single ; echo "exit=$?"
```

### 通过标准

- 退出码非 0。
- stderr 或 stdout 中出现 `does-not-exist` 以及 "profile" 字样，让用户知道是哪一个输入错了。

## Case S-04 - `wolf score --poll` 在空工作区是干净的空操作

**执行方式：** automated
**成本：** free
**Workspace id：** `score-S04`

### 步骤

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S04 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/score-S04 npm run wolf -- score --poll
```

### 通过标准

- 两条命令均以 `0` 退出。
- `score --poll` stdout 包含 `Polled 0 batches`。
- 不涉及任何 AI / 网络调用（`--poll` 不需要 API key）。

## 报告要求

每个 case 记录一行 stdout/stderr 作为证据。S-02 同时记录错误信息中的
`WOLF_*` 变量名，以便将来若有重命名（如改成 `WOLF_ANTHROPIC_KEY`）能被
立即抓到。
