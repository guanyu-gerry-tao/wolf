# JOB-02 - JSON Output 和 Overflow Footer

## 目的

验证 `wolf job list` 的 machine-readable output 和 overflow 行为。

## 覆盖

- `AC-08-8`
- `AC-08-10`

## 执行模式

`automated`

## 成本 / 风险

- Cost: free
- Risk: writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02`。

## Setup

```bash
npm run build:dev
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- add --title "Role One" --company "Acme" --jd-text "One"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- add --title "Role Two" --company "Acme" --jd-text "Two"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- add --title "Role Three" --company "Acme" --jd-text "Three"
```

## 步骤

运行：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- job list --limit 2
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-JOB-02 npm run wolf -- job list --json
```

## 通过标准

- 所有命令退出码都是 `0`。
- `--limit 2` 输出正好显示两行，并有 footer 表示还有一个 matching row。
- `--json` stdout 可以解析为 JSON。
- JSON 包含有三个 entries 的 `jobs` array。
- JSON 包含 `totalMatching` 和 `limited` fields。
- 每次 wolf 调用的 stderr 都出现 dev banner。
- 没有运行时文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`；忽略被 git
  跟踪的占位文件 `data/.gitkeep`。

## 报告要求

包含 table output、footer line、parsed JSON summary、exit codes 和 safety checks。
