# Acceptance Group：MCP Contract

## 状态

Planned。即使少数 tool handler 已存在，MCP 作为 acceptance surface 仍保持 planned；在 MCP contract cases 写好之前，不要把这个 group 当作可运行。

## 产品领域

MCP tool schemas、structured responses、error responses、dev tool naming 和 agent-facing contracts。

## 覆盖目标

- `UC-01.1.2`
- `UC-02.1.2`
- `UC-02.2.2`
- `UC-03.1.2`
- `UC-06.1.2`
- `UC-07.1.2`
- `UC-08.1.2`
- `UC-09.1.2`
- `UC-13`
- `AC-10-1`
- `AC-10-2`
- `AC-10-3`

## 执行模式

schema 和 tool-shape 检查使用 `automated`。带外部副作用的 tool call 继承对应产品 group 的风险模式。

## 报告预期

报告必须包含 tool names、input payloads、output schema validation、structured error evidence，以及任何 dev-mode warning fields。
