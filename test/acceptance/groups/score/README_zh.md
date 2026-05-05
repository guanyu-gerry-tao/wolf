# 验收测试分组：Score

## 状态

已实现。

## 产品范围

通过 Claude Batch API 与同步 Haiku 对职位与 profile 的相关性进行 AI 打分。
覆盖 `wolf score` CLI 与 `POST /api/score` HTTP 路由。本组只验证打分流程；
"dealbreaker" 已被取消，门槛交由下游命令决定，详见 DECISIONS.md。

## 覆盖目标

- `UC-03.1.1`
- `UC-03.1.2`
- `AC-03-1`
- `AC-03-2`
- `AC-03-3`
- `AC-03-4`

## 执行方式

混合：SCORE-AC01 与 SCORE-AC02 是 `automated`，使用 dev-only 的
`WOLF_TEST_AI_RESPONSE_FILE` 环境变量注入预制的 AI 回复，每次 PR 都跑；
SCORE-AC03 是 `ai-reviewed`，付费，默认跳过，只有用户明确授权才运行。

## 成本 / 风险

- SCORE-AC01 / SCORE-AC02：免费（无网络，无需真实 API key，dev binary 自带占位 key 即可）。
- SCORE-AC03：中等（每个固件 JD 一次 Sonnet 调用 × 3 = 3 次）。
- 风险：SCORE-AC03 需要 `WOLF_ANTHROPIC_API_KEY` 或 `WOLF_DEV_ANTHROPIC_API_KEY`。明确开启时缺 key 视为 FAIL，否则 SKIP。

## Cases

- [SCORE-AC01 - 单次模式将解析后的分数写回](SCORE-AC01-single-mocked_zh.md)
- [SCORE-AC02 - 异常 AI 响应被记录为 score_error](SCORE-AC02-malformed-response_zh.md)
- [SCORE-AC03 - 在线 AI 打分质量（付费、默认跳过）](SCORE-AC03-quality-live_zh.md)

## AI Review Rubric

只有 SCORE-AC03 是 `ai-reviewed`，使用
`test/acceptance/reviewers/score-artifact-review_zh.md` 检查分数区间合理性
与 justification 质量。

## 报告要求

报告必须包含输入 JD 固件 id、persona、SQLite 中解析后的 `Job.score` 与
`Job.scoreJustification`，以及任何 `error` / `status` 翻转。SCORE-AC03 还
需附上 reviewer 结果。
