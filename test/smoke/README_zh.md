# Wolf Smoke 测试套件

Smoke tests 是 wolf 的快速门禁。普通 CLI 改动后、交给 review 前，优先跑这一套。

Smoke 验证：

- dev build 能编译
- `wolf init --dev --empty` 能创建隔离 workspace
- 核心 CLI 读写路径不会崩
- 安全规则被遵守
- 每个 group 都写持久化报告

Smoke 不追求完整 use-case 覆盖。完整覆盖属于 `test/acceptance/`。

## 如何运行

把这段提示词复制给 Claude Code 或其他 agent runner：

```text
You are the Wolf Smoke Test Orchestrator.

1. Read test/README.md and test/smoke/README.md.
2. Run in the agent runner's normal execution mode. Use the least interactive
   path available: batch safe commands when allowed, request approval only when
   the runner requires it, continue after approval, and do not stop after
   returning only a plan.
3. Create a run id like smoke-YYYYMMDD-HHMMSS.
4. Ensure /tmp/wolf-test/smoke/<run-id>/workspaces/ and
   test/runs/<run-id>/reports/ exist. Do not delete them yet.
5. Identify every group folder under test/smoke/groups/.
6. Dispatch one sub-agent per group in parallel.
7. Each group agent must:
   a. cd /Users/guanyutao/developers/personal-projects/wolf
   b. run npm run build:dev once for the group
   c. execute the group's README.md cases in order
   d. use WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/<workspace-id>
      for every wolf invocation
   e. write test/runs/<run-id>/reports/<group-id>/report.md
   f. capture stdout, stderr, and exit code for every command
   g. if approval is denied or unavailable, write a BLOCKED report instead of
      returning only a plan
8. After all groups report, print per-group and overall PASS/FAIL/SKIPPED/BLOCKED
   counts, write test/runs/<run-id>/report.md, and update test/runs/LATEST.md.
9. Do not delete /tmp/wolf-test/smoke/<run-id>/ or test/runs/<run-id>/ unless
   the user explicitly asks.
```

## 分组

| Group | 目的 | 执行模式 | 成本 |
|---|---|---|---|
| `bootstrap` | Dev init 和 workspace 隔离 | automated | free |
| `read-commands` | 空 workspace 的读取命令 | automated | free |
| `config` | Config get/set 往返 | automated | free |
| `profile` | 默认 profile 引导 | automated | free |
| `env` | 环境变量显示安全性 | automated | free |
| `job-workflows` | add/status/list job 工作流 | automated | free |

## 报告补充要求

除了全局报告契约，smoke 报告还必须包含：

- 每次 wolf 调用是否出现 dev banner
- 每个 case 使用的精确 `WOLF_DEV_HOME` 路径
- 安全检查：确认没有文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`
