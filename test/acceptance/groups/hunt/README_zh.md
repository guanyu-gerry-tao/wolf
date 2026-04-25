# Acceptance Group：Hunt

## 状态

Planned。这个 group 明确和 `fill`、`score`、`tailor` 分开。

## 产品领域

Job discovery providers、provider failure isolation、URL normalization、dedupe 和 hunt summary output。

## 覆盖目标

- `UC-02.1.1`
- `UC-02.1.2`
- `AC-02-1`
- `AC-02-2`
- `AC-02-3`
- `AC-02-4`

## 执行模式

- 默认：使用 mock 或 fixture providers 的 `automated`。
- 可选：真实外部 provider 使用 `skipped-by-default`。

## 报告预期

报告必须包含 provider 输入、抓取结果、跳过的重复项、保存的行、各 provider 错误，以及最终 CLI 或 MCP summary。

