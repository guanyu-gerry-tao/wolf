# Smoke Group：Read Commands

## 目的

验证基础只读命令在空 workspace 上行为干净。

## 覆盖

- `AC-08-1`
- `AC-08-9`

## Case R-01 - 空 workspace 上的 `wolf status`

**执行模式：** automated  
**成本：** free  
**Workspace id：** `read-R01`

### 目标

确认 dashboard 会把注册的计数器打印为 0，而不是崩溃或只输出一半。

### 步骤

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/read-R01 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/read-R01 npm run wolf -- status
```

### 通过标准

- 两个命令退出码都是 `0`。
- `status` stdout 包含 `tracked`、`tailored` 和 `applied`。
- 每个计数都是 `0`。
- 每次 wolf 调用的 stderr 都出现 dev banner。

## Case R-02 - 空 workspace 上的 `wolf job list --search "%"`

**执行模式：** automated  
**成本：** free  
**Workspace id：** `read-R02`

### 目标

确认空 workspace 对看起来像通配符的搜索词返回友好空状态，而不是 SQL 错误。

### 步骤

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/read-R02 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/read-R02 npm run wolf -- job list --search "%"
```

### 通过标准

- 两个命令退出码都是 `0`。
- `job list` stdout 包含 `No jobs match.`
- 每次 wolf 调用的 stderr 都出现 dev banner。

## 报告要求

记录每条 command 的 stdout/stderr path、exit code，以及作为证据的具体输出行。

