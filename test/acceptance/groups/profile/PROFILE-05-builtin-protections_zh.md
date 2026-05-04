# PROFILE-05 - Builtin question 保护

## 目的

验证 wolf-builtin question 可以回答，但不能修改受保护元数据，也不能删除。

## 覆盖

- `AC-11-7`

## 执行模式

`automated`

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05`。

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- init --dev --empty
```

从 `profile show` 中选一个 builtin question id，并写入报告。runner 可以使用第一个
`required = true` 的 `[[question]]` block。

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile show
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile set question.<builtin-id>.answer "I can answer this builtin safely."
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile set question.<builtin-id>.prompt "Rewrite protected prompt"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile set question.<builtin-id>.required false
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile remove question <builtin-id> --yes
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-05 npm run wolf -- profile get question.<builtin-id>.answer
```

## 通过标准

- 设置 builtin `answer` 退出 `0`。
- 设置 builtin `prompt` 非零退出，stderr 说明 prompt 不能修改。
- 设置 builtin `required` 非零退出，stderr 说明 required flag 不能修改。
- 删除 builtin question 非零退出，stderr 说明 builtin question 不能删除。
- 被拒绝的元数据修改之后，answer 仍能读回。
