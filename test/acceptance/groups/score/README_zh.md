# Acceptance Group：Score

## 状态

Planned - not implemented。

## 产品领域

Job scoring、dealbreaker filters、structured score output、畸形 AI response 处理，以及 single-job scoring。

## 覆盖目标

- `UC-03.1.1`
- `UC-03.1.2`
- `AC-03-1`
- `AC-03-2`
- `AC-03-3`
- `AC-03-4`

## 执行模式

默认 `ai-reviewed`。使用确定性的 fixture jobs，并让 reviewer 验证 score shape、filter decisions 和 justification 质量。真实 model 调用默认 `skipped-by-default`，除非用户明确允许。

## 报告预期

报告必须包含输入 jobs、filtering 使用的 profile facts、model 或 mock response 证据、DB 更新、score summary，以及 reviewer findings。
