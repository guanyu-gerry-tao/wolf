# JOB-GOV-05 - System-managed 字段只读

## 目的

验证 system-managed job 字段可以读取检查，但会被 `wolf job set` 拒绝写入。

## 覆盖

- `AC-12-6`

## 执行模式

`automated`

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05`。

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- add --title "System Fields Fixture" --company "Fixture Company" --jd-text "JD text" --url "https://jobs.example.test/job-gov-05"
```

把返回的 `jobId` 记录为 `<job-id>`。

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job show <job-id>
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job get <job-id> id
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job get <job-id> companyId
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job get <job-id> createdAt
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job get <job-id> updatedAt
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job set <job-id> id rewritten
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-05 npm run wolf -- job set <job-id> createdAt 2026-04-30T00:00:00.000Z
```

## 通过标准

- `job show` 退出 `0`，并包含 `id`、`companyId`、`createdAt`、`updatedAt`。
- 每个 system-managed 字段的 `job get` 都退出 `0` 并打印非空值。
- `job set id` 非零退出，并说明字段是 system-managed。
- `job set createdAt` 非零退出，并说明字段是 system-managed。
