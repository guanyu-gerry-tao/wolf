# Smoke Group：Bootstrap

## 目的

验证 dev build 能在没有交互提示的情况下创建隔离、schema 有效的 workspace。这个 group 是大多数其它 smoke 和 acceptance group 的前置基础。

## 覆盖

- `AC-01-5`
- `AC-01-6`

## Case B-01 - `wolf init --dev --empty` 创建有效 dev workspace

**执行模式：** automated  
**成本：** free  
**Workspace id：** `bootstrap-B01`

### 目标

确认非交互 dev init 路径会写入预期骨架文件、标记 dev workspace，并且不碰真实用户 workspace。

### 步骤

使用：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/bootstrap-B01 npm run wolf -- init --dev --empty
```

### 通过标准

- 退出码是 `0`。
- stderr 出现 dev banner。
- `wolf.toml` 存在于测试 workspace 下。
- `profiles/default/profile.toml` 存在于测试 workspace 下。
- `profiles/default/resume_pool.md` 存在于测试 workspace 下。
- `data/` 存在于测试 workspace 下。
- `wolf.toml` 包含 `[instance]` 和 `mode = "dev"`。
- 没有文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`。

### 报告要求

记录 command、exit code、stdout path、stderr path、文件存在性检查、证明 dev mode 的 `wolf.toml` 摘录，以及安全检查结果。

