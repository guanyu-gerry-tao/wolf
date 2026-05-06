# PROFILE-01 - Fields 参考和原始读取

## 目的

验证 profile schema 发现由 `PROFILE_FIELDS` 驱动，并且 raw/profile 字段读取适合管道使用。

## 覆盖

- `AC-11-1`
- `AC-11-2`

## 执行模式

`automated`

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01`。

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile set identity.legal_first_name Ada
```

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile fields
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile fields --required
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile fields --json
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile fields identity.legal_first_name
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile show
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-01 npm run wolf -- profile get identity.legal_first_name
```

## 通过标准

- 所有命令退出 `0`。
- `profile fields` 包含 `identity.legal_first_name`、`contact.email`、required/optional 分组和 help text。
- `profile fields --required` 包含 required 字段，并排除 `resume.note` 等 optional-only path。
- `profile fields --json` 可解析为 JSON，且 row 含 `path`、`required`、`type`、`help`。
- `profile fields identity.legal_first_name` 只打印该 path 的元数据。
- `profile show` 打印 raw `profile.toml`，包含注释和 `Ada`。
- `profile get identity.legal_first_name` 只打印 `Ada` 加一个尾随换行。
