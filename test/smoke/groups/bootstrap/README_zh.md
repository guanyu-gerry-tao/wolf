# Smoke Group：Bootstrap

## 目的

验证 dev build 能在没有交互提示的情况下创建隔离、schema 有效的 workspace。这个 group 是大多数其它 smoke 和 acceptance group 的前置基础。

## 覆盖

- `AC-01-5`
- `AC-01-6`

## Case B-01 - `wolf init --preset empty` 创建有效 dev workspace

**执行模式：** automated
**成本：** free
**Workspace id：** `bootstrap-B01`

### 目标

确认非交互 dev init 路径会写入预期骨架文件、标记 dev workspace，并且不碰真实用户 workspace。

### 步骤

使用：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/bootstrap-B01 npm run wolf -- init --preset empty
```

### 通过标准

- 退出码是 `0`。
- stderr 出现 dev banner。
- `wolf.toml` 存在于测试 workspace 下。
- `profiles/default/profile.toml` 存在于测试 workspace 下。
- `profiles/default/attachments/README.md` 存在于测试 workspace 下。
- `profiles/default/score.md` 存在于测试 workspace 下。
- `data/` 存在于测试 workspace 下。
- init 结束后 `data/wolf.sqlite` 不存在。
- `wolf.toml` 包含 `[instance]` 和 `mode = "dev"`。
- `wolf.toml` 包含 `default = "default"`(profile 文件夹指针)。
- 没有文件写入 `~/wolf`、`~/wolf-dev`，也没有运行时文件写入 repo 内 `data/`；
  忽略被 git 跟踪的占位文件 `data/.gitkeep`。

### 报告要求

记录 command、exit code、stdout path、stderr path、文件存在性检查、证明 dev mode 的 `wolf.toml` 摘录、`data/wolf.sqlite` 不存在的检查，以及安全检查结果。

## Case B-02 - `wolf init --preset default` 创建 dev 演示 profile

**执行模式：** automated
**成本：** free
**Workspace id：** `bootstrap-B02`

### 目标

确认 dev-only preset 路径会为演示和 acceptance 调试写入已填好的默认 profile，同时保持 job search 存储为空。

### 步骤

使用：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/bootstrap-B02 npm run wolf -- init --preset default
```

### 通过标准

- 退出码是 `0`。
- stderr 出现 dev banner。
- `wolf.toml` 包含 `[instance]` 和 `mode = "dev"`。
- `profiles/default/profile.toml` 包含 default preset 的 identity、resume
  entries、projects、education、skills 和 builtin question answers。
- `data/` 存在于测试 workspace 下。
- init 结束后 `data/wolf.sqlite` 不存在，证明 preset 没有写入 SQLite job/search 记录。

### 报告要求

记录 command、exit code、stdout path、stderr path、证明 dev mode 的 `wolf.toml`
摘录、证明 preset 内容的 profile 摘录，以及 `data/wolf.sqlite` 不存在的检查。
