# Acceptance Group：Job 数据治理

## 状态

已实现。本 group 负责 β.10h 之后的 `wolf job` 行级数据治理表面：schema 发现、行读取、
类型化写入、salary range 约定，以及 system-managed 字段保护。

## 产品领域

`wolf job show / get / set / fields`。

## 覆盖目标

- `AC-12-1`
- `AC-12-2`
- `AC-12-3`
- `AC-12-4`
- `AC-12-5`
- `AC-12-6`

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
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/job-<case-id>
```

Case 可以用 `wolf add` 和 fixture JD seed job。执行 `wolf job show/get/set/fields`
之前，必须把返回的 `jobId` 写入报告。

## Cases

- [JOB-GOV-01 - Fields 参考和行读取](JOB-GOV-01-fields-and-reads_zh.md)
- [JOB-GOV-02 - 可编辑字段写入](JOB-GOV-02-editable-writes_zh.md)
- [JOB-GOV-03 - Salary zero-plus-range 约定](JOB-GOV-03-salary-convention_zh.md)
- [JOB-GOV-04 - 无效 job 写入被拒绝](JOB-GOV-04-invalid-writes_zh.md)
- [JOB-GOV-05 - System-managed 字段只读](JOB-GOV-05-system-managed_zh.md)

## 报告要求

报告必须包含命令行、退出码、stdout/stderr 日志路径、workspace 路径、返回的 `jobId`、
字段写入前后值、校验错误摘要，以及 protected-path safety check，证明没有写入
`~/wolf`、`~/wolf-dev` 或 repo-local `data/`。
