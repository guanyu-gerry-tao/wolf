# Smoke Group：Profile

## 目的

验证 init 会创建 active default profile。

## Case P-01 - `wolf profile list` 显示 default profile

**执行模式：** automated  
**成本：** free  
**Workspace id：** `profile-P01`

### 步骤

```bash
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/profile-P01 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/profile-P01 npm run wolf -- profile list
```

### 通过标准

- 两个命令退出码都是 `0`。
- stdout 包含带 `*` 的 `default` profile 行。
- 每次 wolf 调用的 stderr 都出现 dev banner。

## 报告要求

记录作为证据的 profile list 输出行。

