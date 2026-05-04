# Acceptance Group：Profile 数据治理

## 状态

已实现。本 group 负责 `profile.toml` 的 CLI 数据治理表面：schema 发现、精确读写、
数组 entry、自定义 question、builtin 保护，以及校验失败。

## 产品领域

`wolf profile show / get / set / fields / add / remove`。

## 覆盖目标

- `AC-11-1`
- `AC-11-2`
- `AC-11-3`
- `AC-11-4`
- `AC-11-5`
- `AC-11-6`
- `AC-11-7`
- `AC-11-8`

## 执行模式

`automated`。

## 成本 / 风险

- Cost：free
- Risk：writes-temp

## 前置条件

每个 group 先运行一次 dev build：

```bash
npm run build:dev
```

每个 case 必须使用如下 workspace：

```text
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/profile-<case-id>
```

## Cases

- [PROFILE-01 - Fields 参考和原始读取](PROFILE-01-fields-and-reads_zh.md)
- [PROFILE-02 - 标量和多行字段写入](PROFILE-02-field-writes_zh.md)
- [PROFILE-03 - Resume entry 生命周期](PROFILE-03-entry-lifecycle_zh.md)
- [PROFILE-04 - 自定义 question 生命周期](PROFILE-04-question-lifecycle_zh.md)
- [PROFILE-05 - Builtin question 保护](PROFILE-05-builtin-protections_zh.md)
- [PROFILE-06 - 无效 profile 写入被拒绝](PROFILE-06-invalid-writes_zh.md)

## 报告要求

报告必须包含命令行、退出码、stdout/stderr 日志路径、workspace 路径、写入前后的
`profile.toml` 关键片段、返回的 entry id、校验错误摘要，以及 protected-path
safety check，证明没有运行时文件写入 `~/wolf`、`~/wolf-dev` 或 repo-local
`data/`；忽略被 git 跟踪的占位文件 `data/.gitkeep`。
