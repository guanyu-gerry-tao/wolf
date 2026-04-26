# Acceptance Group：Tailor

## 状态

Implemented。

## 产品领域

Resume tailoring、cover-letter generation、生成产物、PDF screenshots，以及输出质量的 AI review。

## 覆盖目标

- `UC-06.1.1`
- `UC-06.1.2`
- `UC-07.1.1`
- `UC-07.1.2`
- `AC-04-1`
- `AC-04-2`
- `AC-04-3`
- `AC-04-4`
- `AC-05-1`
- `AC-05-2`
- `AC-05-3`

## 执行模式

`ai-reviewed`。人工复核是可选项，不是默认执行者。

## 成本 / 风险

- Cost: medium to high
- Risk: external-api
- Requires: `WOLF_ANTHROPIC_API_KEY` 或 `WOLF_DEV_ANTHROPIC_API_KEY`；未来 OpenAI-compatible provider 如果已通过 wolf config 配好，也可以使用。
- 缺少必需 API credentials 是 `FAIL`，不是 `SKIPPED`。报告必须写明缺哪个 key，
  并告诉用户如何配置。

## Cases

- [TAILOR-01 - 一个 fixture job 的完整 tailor pipeline](TAILOR-01-full-pipeline_zh.md)
- [TAILOR-02 - 分步 brief、resume 和 cover letter](TAILOR-02-stepwise-pipeline_zh.md)
- [TAILOR-03 - Analyst hint 被写入并生效](TAILOR-03-hint-guidance_zh.md)
- [TAILOR-04 - Section 诚实性与 pool 驱动的顺序](TAILOR-04-section-honesty_zh.md)

## AI 评审 Rubric

使用 `test/acceptance/reviewers/tailor-artifact-review.md`。reviewer 必须检查
source resume facts、JD facts、生成的 resume、cover letter 和 PDF screenshot
证据。评审必须判断事实准确性、JD 相关性、无依据声称、格式、一页行为，以及失败时的具体修复建议。

## 报告预期

报告必须包含 artifact paths、screenshots 或 screenshot paths、reviewer findings、bugs 和 improvements。
