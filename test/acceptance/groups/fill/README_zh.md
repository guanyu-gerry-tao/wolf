# Acceptance Group：Fill

## 状态

Planned - not implemented。

## 产品领域

Application form analysis、dry-run mapping、fixture-page filling、screenshot capture、status updates 和 live submit 边界。

## 覆盖目标

- `UC-08.1.1`
- `UC-08.1.2`
- `AC-06-1`
- `AC-06-2`
- `AC-06-3`
- `AC-06-4`
- `AC-06-5`

## 执行模式

- Fixture dry-run 和本地 fixture page：`automated` 或 `ai-reviewed`。
- 真实网站提交：`human-approval` 且默认 `skipped-by-default`。

## 人工批准指导

Live submit 测试必须在提交真实申请前停止。批准任何外部副作用前，测试员必须看到 target URL、已填写字段、附件、预期结果、边界情况、停止条件和清理说明。

## 报告预期

报告必须包含 form fixture path 或 URL、field mapping、screenshot path、提交是否被阻止或批准，以及任何 browser errors。
