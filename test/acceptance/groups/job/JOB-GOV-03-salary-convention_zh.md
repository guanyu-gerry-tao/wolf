# JOB-GOV-03 - Salary zero-plus-range 约定

## 目的

验证 β.10j/k 的 salary 约定：`0` 表示明确 unpaid，blank/null 表示 unknown，且
`salaryLow=0` 可以和正数 `salaryHigh` 共存。

## 覆盖

- `AC-12-4`

## 执行模式

`automated`

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03`。

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- add --title "Unpaid Base Plus Bonus" --company "Fixture Company" --jd-text "Unpaid base with potential bonus." --url "https://jobs.example.test/job-gov-03"
```

把返回的 `jobId` 记录为 `<job-id>`。

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job get <job-id> salaryLow
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job get <job-id> salaryHigh
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job set <job-id> salaryLow 0
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job set <job-id> salaryHigh 30000
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job get <job-id> salaryLow
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job get <job-id> salaryHigh
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-03 npm run wolf -- job fields salaryLow
```

## 通过标准

- 初始 salary 字段读回为空/unknown。
- `job set salaryLow 0` 和 `job set salaryHigh 30000` 都退出 `0`。
- `salaryLow` 精确读回 `0`。
- `salaryHigh` 精确读回 `30000`。
- `job fields salaryLow` 文档说明 `0` 表示 unpaid，blank 表示 unknown。
