# Acceptance Group：Add

## 状态

Implemented。

## 产品领域

通过 `wolf add` 手动录入 job：结构化 job 存储、company 创建、JD 文件持久化，以及通过 `wolf status` 和 `wolf job list` 的下游可见性。

## 覆盖目标

- `UC-02.2.1`
- `UC-02.2.2`（只覆盖 CLI 等价的存储行为；MCP 仍然 planned）
- `AC-10-1`（只覆盖 CLI 等价的 `jobId` 形态；MCP 仍然 planned）

## 执行模式

`automated`。

## Cases

- [ADD-01 - 添加一个结构化 job](ADD-01-one-structured-job_zh.md)
- [ADD-02 - Add 把 JD 写入 job workspace](ADD-02-jd-file-persistence_zh.md)

## 报告预期

报告必须包含返回的 `jobId`、command stdout/stderr logs、workspace paths、JD file 证据、status/list 证据，以及任何 bugs 或 improvements。

