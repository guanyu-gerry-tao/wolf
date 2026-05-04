# PROFILE-03 - Resume entry 生命周期

## 目的

验证 resume-source array entry 的新增、编辑和删除。

## 覆盖

- `AC-11-5`

## 执行模式

`automated`

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03`。

## Setup

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- init --dev --empty
mkdir -p /tmp/wolf-test/acceptance/<run-id>/inputs
printf '%s\n' '- Built backend fixture service' '- Improved acceptance report quality' > /tmp/wolf-test/acceptance/<run-id>/inputs/experience-bullets.md
```

## Steps

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile add experience --id acme-backend
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile set experience.acme-backend.company "Acme Systems"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile set experience.acme-backend.bullets --from-file /tmp/wolf-test/acceptance/<run-id>/inputs/experience-bullets.md
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile get experience.acme-backend.company
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile remove experience acme-backend --yes
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-PROFILE-03 npm run wolf -- profile show
```

## 通过标准

- `profile add experience --id acme-backend` 退出 `0` 并打印 `Added experience.acme-backend`。
- 设置 `experience.acme-backend.company` 退出 `0`。
- 读取 `experience.acme-backend.company` 打印 `Acme Systems`。
- 带 `--yes` 删除退出 `0` 并打印 `Removed experience.acme-backend`。
- 最后的 `profile show` 不再包含 `id = "acme-backend"`。
