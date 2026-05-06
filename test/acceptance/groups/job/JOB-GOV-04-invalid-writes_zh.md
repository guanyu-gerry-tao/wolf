# JOB-GOV-04 - 无效 job 写入被拒绝

## 目的

验证 `wolf job set` 会拒绝无效值，并保留此前的 row 值不变。

## 覆盖

- `AC-12-5`

## 执行模式

`automated`

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04`。

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- add --title "Invalid Write Fixture" --company "Fixture Company" --jd-text "JD text" --url "https://jobs.example.test/job-gov-04"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> status new
```

把返回的 `jobId` 记录为 `<job-id>`。

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> nope value
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> status bogus
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> remote maybe
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> score not-a-number
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job set <job-id> salaryLow unpaid
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-04 npm run wolf -- job get <job-id> status
```

## 通过标准

- 未知字段 `nope` 非零退出，并提示 `job fields`。
- 非法 enum `status bogus` 非零退出，并列出或提到合法值。
- 非法 boolean `remote maybe` 非零退出。
- 非法 number `score not-a-number` 非零退出。
- 已移除的 sentinel `salaryLow unpaid` 非零退出，并说明值必须是数字。
- 最后的 `job get status` 仍打印 `new`。
