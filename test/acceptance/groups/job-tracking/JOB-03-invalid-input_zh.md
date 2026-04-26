# JOB-03 - Invalid Input 被拒绝

## 目的

验证 `wolf job list` 会拒绝 invalid input，而不是静默返回空结果。

## 覆盖

- `AC-08-7`
- `AC-08-11`
- `AC-08-12`

## 执行模式

`automated`

## 成本 / 风险

- Cost: free
- Risk: writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03`。

## Setup

```bash
npm run build:dev
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03 npm run wolf -- init --dev --empty
```

## 步骤

逐条运行并捕获 exit code、stdout 和 stderr：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03 npm run wolf -- job list --status bogus
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03 npm run wolf -- job list --min-score abc
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03 npm run wolf -- job list --start not-a-date
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-03 npm run wolf -- job list --limit 0
```

## 通过标准

- `init` 退出码是 `0`。
- 每条 invalid command 都以非零状态退出。
- 每条 invalid command 都打印清晰错误，指出 offending flag 或合法值。
- 没有 invalid command 静默打印 `No jobs match.`
- 每次 wolf 调用的 stderr 都出现 dev banner。
- 没有文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`。

## 报告要求

包含每条 invalid command、exit code、stderr excerpt，以及该命令是否因预期原因失败。

