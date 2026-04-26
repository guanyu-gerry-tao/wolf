# ADD-02 - JD 文件持久化

## 目的

验证 `wolf add` 会把 job description 写入磁盘上的 job workspace，而不只是写入 SQLite。

## 覆盖

- `UC-02.2.1`

## 执行模式

`automated`

## 成本 / 风险

- Cost: free
- Risk: writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02`。

## Setup

```bash
npm run build:dev
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- init --dev --empty
```

## 步骤

运行：

```bash
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 291)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- add --title "Data Scientist" --company "Fixture Company" --jd-text "$JD_TEXT"
```

从 stdout 提取 `jobId`。然后检查 workspace：

```bash
find /tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02/data/jobs -name jd.md -print
```

打开 `find` 找到的唯一 `jd.md`。

## 通过标准

- `init` 和 `add` 退出码都是 `0`。
- `add` stdout 包含非空 `jobId`。
- `data/jobs/` 下正好有一个 `jd.md`。
- `jd.md` 包含 `Data Scientist`。
- job workspace 目录名包含 company 和 title slug。
- 没有文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`。

## 报告要求

包含 fixture 路径、source row id、返回的 `jobId`、`jd.md` 路径、一小段 `jd.md` 摘录，以及 protected-path safety check。
