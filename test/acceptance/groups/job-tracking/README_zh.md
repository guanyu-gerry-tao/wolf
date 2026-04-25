# Acceptance Group：Job Tracking

## 状态

Planned。Smoke 只覆盖很窄的 happy path；这个 group 负责完整 list 和 status 行为。

## 产品领域

`wolf status` 和 `wolf job list`，包括 structured filters、repeatable search、time ranges、JSON output、overflow footer 和 invalid input。

## 覆盖目标

- `AC-08-1`
- `AC-08-2`
- `AC-08-3`
- `AC-08-4`
- `AC-08-5`
- `AC-08-6`
- `AC-08-6b`
- `AC-08-6c`
- `AC-08-7`
- `AC-08-8`
- `AC-08-9`
- `AC-08-10`
- `AC-08-11`
- `AC-08-12`

## 执行模式

`automated`。

## 报告预期

报告必须包含 seeded jobs、command output、适用时的 JSON output、filters 的 expected/actual row ids，以及 invalid-input 行为的清晰 bug entries。

