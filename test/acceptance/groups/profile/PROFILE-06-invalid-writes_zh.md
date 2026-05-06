# PROFILE-06 - 无效 profile 写入被拒绝

## 目的

验证 profile 校验失败有用户可读错误，并且不会破坏已有数据。

## 覆盖

- `AC-11-8`

## 执行模式

`automated`

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06`。

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- init --preset empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile set contact.email before@example.test
```

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile set contact.nope value
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile add nope --id bad
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile remove experience missing-id
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile set contact.email
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-06 npm run wolf -- profile get contact.email
```

## 通过标准

- 无效的 `set contact.nope` 非零退出，并提示 `profile fields`。
- 无效的 `add nope` 非零退出，并列出允许的类型。
- 不带 `--yes` 的 `remove experience missing-id` 非零退出，并显示更安全的 `--yes` 命令。
- `profile set contact.email` 缺少 value 时非零退出，并提到 `--from-file`。
- 最后的 `profile get contact.email` 仍打印 `before@example.test`。
