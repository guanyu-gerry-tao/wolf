# Smoke Group：Config

## 目的

验证 config 能读取默认值，并安全写入用户修改。

## 覆盖

- E3 config/profile 管理行为

## Case C-01 - `wolf config get tailor.model` 返回默认值

**执行模式：** automated  
**成本：** free  
**Workspace id：** `config-C01`

### 步骤

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/config-C01 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/config-C01 npm run wolf -- config get tailor.model
```

### 通过标准

- 两个命令退出码都是 `0`。
- 最终 stdout 包含 `anthropic/claude-sonnet-4-6`。
- 每次 wolf 调用的 stderr 都出现 dev banner。

## Case C-02 - `wolf config set` 通过 `wolf.toml` 写入并读回

**执行模式：** automated  
**成本：** free  
**Workspace id：** `config-C02`

### 步骤

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/config-C02 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/config-C02 npm run wolf -- config set tailor.model anthropic/claude-haiku-4-5
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/config-C02 npm run wolf -- config get tailor.model
```

### 通过标准

- 所有命令退出码都是 `0`。
- 最终 stdout 包含 `anthropic/claude-haiku-4-5`。
- 测试 workspace 下存在 `wolf.toml.backup1`。
- 每次 wolf 调用的 stderr 都出现 dev banner。

## 报告要求

记录 config 修改前后证据，以及 backup 文件检查。

