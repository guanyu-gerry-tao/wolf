# PROFILE-04 - 自定义 question 生命周期

## 目的

验证 β.10g 的 `wolf profile add question --prompt --answer` 表面和自定义 question 删除。

## 覆盖

- `AC-11-6`

## 执行模式

`automated`

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04`。

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- init --dev --empty
```

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile add question --id custom-open-source --prompt "Describe your open source work." --answer "I maintain fixture tools for realistic CLI tests."
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile get question.custom-open-source.prompt
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile get question.custom-open-source.answer
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile get question.custom-open-source.required
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile remove question custom-open-source --yes
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-04 npm run wolf -- profile show
```

## 通过标准

- `profile add question` 退出 `0` 并打印 `Added question.custom-open-source`。
- prompt 和 answer 能精确读回。
- `question.custom-open-source.required` 读回 `false`。
- 删除自定义 question 退出 `0`。
- 最后的 `profile show` 不包含 `custom-open-source`。
