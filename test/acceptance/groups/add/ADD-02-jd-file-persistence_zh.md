# ADD-02 - JD Description 持久化

## 目的

验证 `wolf add` 会把 job description 写入 canonical job record，并通过受数据治理的
`wolf job` 读取表面暴露出来。

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
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- init --preset empty
```

## 步骤

运行：

```bash
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 291)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- add --title "Data Scientist" --company "Fixture Company" --jd-text "$JD_TEXT"
```

从 stdout 提取 `jobId`。然后检查 canonical job fields：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- job get <jobId> description_md
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02 npm run wolf -- job show <jobId> --json
```

同时确认 workspace 不再依赖旧的 `data/jobs/**/jd.md` artifact：

```bash
find /tmp/wolf-test/acceptance/<run-id>/workspaces/add-ADD-02/data/jobs -name jd.md -print
```

## 通过标准

- `init` 和 `add` 退出码都是 `0`。
- `add` stdout 包含非空 `jobId`。
- `job get <jobId> description_md` 退出码 `0`，且包含 `Data Scientist`。
- `job show <jobId> --json` 退出码 `0`，JSON payload 中包含同一份 description。
- 旧的 `find ... -name jd.md` 检查不输出任何内容；JD 的 source of truth 是 job
  record，不是 legacy markdown sidecar file。
- 没有运行时文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`；忽略被 git
  跟踪的占位文件 `data/.gitkeep`。

## 报告要求

包含 fixture 路径、source row id、返回的 `jobId`、从 `wolf job get` 得到的一小段
`description_md` 摘录、`job show --json` 证据、legacy `jd.md` absence check，以及
protected-path safety check。
