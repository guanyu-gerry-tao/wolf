# PROFILE-02 - 标量和多行字段写入

## 目的

验证 `wolf profile set` 能精确更新标量和多行字段，包括 `--from-file`。

## 覆盖

- `AC-11-3`
- `AC-11-4`

## 执行模式

`automated`

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02`。

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- init --preset empty
mkdir -p /tmp/wolf-test/acceptance/<run-id>/inputs
printf 'Line one\nLine two\n' > /tmp/wolf-test/acceptance/<run-id>/inputs/profile-note.txt
```

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- profile set contact.email ada@example.test
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- profile get contact.email
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- profile set resume.note --from-file /tmp/wolf-test/acceptance/<run-id>/inputs/profile-note.txt
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- profile get resume.note
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-02 npm run wolf -- profile show
```

## 通过标准

- 所有成功命令退出 `0`。
- `profile set contact.email` 确认 `set contact.email`。
- `profile get contact.email` 打印 `ada@example.test`。
- `profile get resume.note` 打印 `Line one` 和 `Line two`。
- 存储的多行值没有因为虚假尾随换行产生额外空行。
- `profile show` 仍包含无关字段附近的模板注释，证明写入是精确的。
