# ADD-01 - 添加一个结构化 Job

## 目的

验证 `wolf add` 会存储结构化 job、返回 `jobId`、更新 tracked 计数，并且该 job 能通过 `wolf job list` 看到。

## 覆盖

- `UC-02.2.1`
- `AC-10-1`（CLI 等价的 `jobId` response 形态）

## 执行模式

`automated`

## 成本 / 风险

- Cost: free
- Risk: writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-01`。

## Setup

group 内先运行一次 dev build：

```bash
npm run build:dev
```

创建并初始化 workspace：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-01 npm run wolf -- init --dev --empty
```

## 步骤

运行：

```bash
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 119)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-01 npm run wolf -- add --title "Member of Technical Staff, Backend" --company "Fixture Company" --jd-text "$JD_TEXT" --url "https://jobs.example.test/fixture/backend?ref=wolf"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-01 npm run wolf -- status
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-01 npm run wolf -- job list --search "Fixture Company"
```

## 通过标准

- `init`、`add`、`status` 和 `job list` 退出码都是 `0`。
- 每次 wolf 调用的 stderr 都出现 dev banner。
- `add` stdout 是 JSON，且包含非空 `jobId` 字符串。
- `status` 显示 `tracked  1`。
- `job list --search "Fixture Company"` 显示 `Fixture Company` 和 `Member of Technical Staff, Backend`。
- 没有文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`。

## 报告要求

把 group report 写到 `/tmp/wolf-test/acceptance/<run-id>/reports/add/report.md`。包含：

- commands 和 exit codes
- stdout/stderr log paths
- 返回的 `jobId`
- fixture 路径、source row id 和 fixture 来源策略引用
- `status` 证据
- `job list` 证据
- protected-path safety check
- 结果：`PASS`、`FAIL`、`SKIPPED` 或 `BLOCKED`
