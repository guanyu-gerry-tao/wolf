# JOB-GOV-01 - Fields 参考和行读取

## 目的

验证 `wolf job fields` 由 `JOB_FIELDS` 驱动，并且 `show`/`get` 能读取 flat column 和 JD 正文。

## 覆盖

- `AC-12-1`
- `AC-12-2`

## 执行模式

`automated`

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01`。

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- init --dev --empty
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 119)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- add --title "Backend Fixture Engineer" --company "Fixture Company" --jd-text "$JD_TEXT" --url "https://jobs.example.test/job-gov-01"
```

把返回的 `jobId` 记录为 `<job-id>`。

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job fields
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job fields --required
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job fields --json
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job fields salaryLow
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job show <job-id>
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job show <job-id> --json
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job get <job-id> title
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-GOV-01 npm run wolf -- job get <job-id> description_md
```

## 通过标准

- 所有命令退出 `0`。
- `job fields` 包含 `title`、`salaryLow`、`salaryHigh`、`description_md` 等可编辑字段。
- `job fields --required` 排除 `scoreJustification` 等 optional 字段。
- `job fields --json` 可解析为 JSON，且 row 含 `name`、`type`、`required`、`help`。
- `job show` 包含 `Backend Fixture Engineer`、`Fixture Company`、system-managed 字段和 `--- description_md ---` section。
- `job show --json` 可解析为 JSON，且包含 `fields`、`descriptionMd`、`companyName`。
- `job get title` 只打印 `Backend Fixture Engineer`。
- `job get description_md` 打印 seed 的 JD 正文。
