# JOB-01 - Structured Filters 和 Repeated Search

## 目的

验证 `wolf job list` 会把重复 `--search` 按 OR 组合，把 structured filters 按 AND 组合。

## 覆盖

- `AC-08-3`
- `AC-08-4`
- `AC-08-5`
- `AC-08-6`
- `AC-08-6b`
- `AC-08-9`

## 执行模式

`automated`

## 成本 / 风险

- Cost: free
- Risk: writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01`。

## Setup

```bash
npm run build:dev
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- add --title "Backend Engineer" --company "Acme" --jd-text "Build TypeScript APIs."
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- add --title "Frontend Engineer" --company "Acme" --jd-text "Build React UI."
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- add --title "Data Engineer" --company "Northstar" --jd-text "Build data pipelines."
```

## 步骤

运行：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- job list
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- job list --search Backend
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- job list --search Backend --search Northstar
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- job list --search Acme --status new
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-01 npm run wolf -- job list --search Missing
```

## 通过标准

- 所有 setup 和 list 命令退出码都是 `0`。
- 默认 `job list` 显示三个 jobs。
- `--search Backend` 显示 `Backend Engineer`，不显示 `Frontend Engineer`。
- 重复 search 显示 `Backend Engineer` 和 `Northstar`。
- `--search Acme --status new` 显示两个 Acme jobs。
- Missing search 输出 `No jobs match.`
- 每次 wolf 调用的 stderr 都出现 dev banner。
- 没有运行时文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`；忽略被 git
  跟踪的占位文件 `data/.gitkeep`。

## 报告要求

包含 setup commands、所有 list outputs、expected/actual visible job titles、exit codes 和 safety checks。
