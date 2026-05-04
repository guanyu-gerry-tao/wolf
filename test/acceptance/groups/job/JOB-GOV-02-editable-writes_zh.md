# JOB-GOV-02 - 可编辑字段写入

## 目的

验证可编辑 job 字段的类型化更新，包括对 JD 正文使用 `--from-file`。

## 覆盖

- `AC-12-3`

## 执行模式

`automated`

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02`。

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- add --title "Governance Test Role" --company "Fixture Company" --jd-text "Original JD text" --url "https://jobs.example.test/job-gov-02"
mkdir -p /tmp/wolf-test/acceptance/<run-id>/inputs
printf 'Updated JD line one\nUpdated JD line two\n' > /tmp/wolf-test/acceptance/<run-id>/inputs/job-description.md
```

把返回的 `jobId` 记录为 `<job-id>`。

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job set <job-id> status applied
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job get <job-id> status
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job set <job-id> score 0.82
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job get <job-id> score
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job set <job-id> remote true
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job get <job-id> remote
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job set <job-id> description_md --from-file /tmp/wolf-test/acceptance/<run-id>/inputs/job-description.md
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-02 npm run wolf -- job get <job-id> description_md
```

## 通过标准

- 所有命令退出 `0`。
- `status` 读回 `applied`。
- `score` 读回 `0.82` 或等价数字字符串。
- `remote` 读回 `true`。
- `description_md` 读回两行更新后的 JD，且没有额外虚假空行。
