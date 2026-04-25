# Smoke Group：Env

## 目的

验证环境变量状态显示是安全的，不会泄漏 secret。

## 覆盖

- `AC-09-1`
- `AC-09-2`

## Case E-01 - 没有 key 时的 `wolf env show`

**执行模式：** automated  
**成本：** free  
**Workspace id：** `env-E01`

### 步骤

```bash
env -u WOLF_ANTHROPIC_API_KEY -u WOLF_APIFY_API_TOKEN -u WOLF_GMAIL_CLIENT_ID -u WOLF_GMAIL_CLIENT_SECRET WOLF_DEV_HOME=/tmp/wolf-test/smoke/<run-id>/workspaces/env-E01 npm run wolf -- env show
```

不要运行 `wolf env clear`。

### 通过标准

- 命令退出码是 `0`。
- stdout 标记每个 key 为 not set。
- stdout 不包含任何 secret 值。
- stderr 出现 dev banner。

## 报告要求

记录脱敏后的 stdout 证据。不要在报告里包含真实 secret 值。

