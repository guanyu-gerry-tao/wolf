# Smoke Group：Job Workflows

## 目的

验证基础 job tracking workflow 可以在同一个 workspace 中写入 job、更新 dashboard 计数，并列出匹配 job。

## 覆盖

- `UC-02.2.1`
- `AC-08-1`
- `AC-08-3`
- `AC-08-5`
- `AC-08-9`

## Case J-01 - add -> status -> list happy path

**执行模式：** automated  
**成本：** free  
**Workspace id：** `jobs-J01`

### 步骤

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J01 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J01 npm run wolf -- add --title "Backend Engineer" --company "Acme" --jd-text "Build APIs in TypeScript."
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J01 npm run wolf -- status
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J01 npm run wolf -- job list --search Acme
```

### 通过标准

- 所有命令退出码都是 `0`。
- `add` 返回包含 `jobId` 的 JSON。
- `status` 显示 `tracked  1`。
- `job list` 显示 `Acme` 和 `Backend Engineer`。
- 每次 wolf 调用的 stderr 都出现 dev banner。

## Case J-02 - 多 job 搜索行为

**执行模式：** automated  
**成本：** free  
**Workspace id：** `jobs-J02`

### 步骤

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J02 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J02 npm run wolf -- add --title "Frontend Engineer" --company "Acme" --jd-text "React UI work."
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J02 npm run wolf -- add --title "Platform Engineer" --company "Acme" --jd-text "Internal platform work."
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J02 npm run wolf -- job list --search Acme
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/jobs-J02 npm run wolf -- job list --search Other
```

### 通过标准

- 所有命令退出码都是 `0`。
- `Acme` 搜索显示两个 job。
- `Other` 搜索输出 `No jobs match.`
- 每次 wolf 调用的 stderr 都出现 dev banner。

## 报告要求

记录返回的 job id、status 证据、匹配列表输出和空状态输出。

