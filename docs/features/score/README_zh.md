# Score 功能交接

## 状态

当前 tier-based scoring 范围已实现。

`wolf score` 可以把 tracked jobs 按当前 profile 送去打分，写回 AI tier
verdict，并保存一段可审查的 markdown 解释。该功能已有单元测试、smoke
测试与 score acceptance group 覆盖。SCORE-AC03 是付费 live-AI 质量检查；
它的验收标准是 live scoring 能返回合法 tier 与有根据的解释，而不是要求某个
fixture 必须落到某一个固定 tier。

## 用户入口

- `wolf score`：把所有尚未 AI 打分的 job 提交到异步 AI Batch API。
- `wolf score --poll`：拉取已完成的 score batch，并把结果写回 job row。
- `wolf score --single --jobs <JOB_ID>`：同步打一个 job，并在终端打印标准
  markdown verdict。
- `wolf job set <JOB_ID> tier <tier>`：设置用户 override。AI scoring 写
  `tierAi`；用户 override 写 `tierUser`。
- `wolf job list --tier <tiers>`：按 effective tier 过滤：
  `tierUser ?? tierAi`。

合法 tier 是 `skip`、`mass_apply`、`tailor`、`invest`。

## 数据契约

Scoring 写这些 `Job` 字段：

- `tierAi`：nullable integer，指向 `TIER_NAMES` 的 index。
- `scoreJustification`：包含 `## Tier`、`## Pros`、`## Cons` 的 markdown。
- provider 或解析失败时写 `status: error` 与 `error: score_error`。

Scoring 不能写 `tierUser`。用户 override 必须独立保存，避免后续 AI 重跑覆盖
用户判断。

## 实现地图

- CLI：`src/cli/commands/score.ts`
- Application orchestration：
  `src/application/impl/scoreApplicationServiceImpl.ts`
- Service contract：`src/service/scoringService.ts`
- Prompt 与 parser：`src/service/impl/scoringServiceImpl.ts` 和
  `src/service/impl/prompts/score-system.md`
- Tier 名称与 index：`src/utils/scoringTiers.ts`
- Job 字段与过滤：`src/utils/jobFields.ts`、`src/repository/jobRepository.ts`
  以及其实现

Application service 负责写回与 batch polling。Scoring service 只负责构造或
执行 AI scoring 请求，并返回解析后的 verdict。

## AI 契约

模型应输出：

```xml
<tier>skip | mass_apply | tailor | invest</tier>
<pros>...</pros>
<cons>...</cons>
```

Parser 会把响应转换为存储用的 markdown 解释。tag 缺失或非法时，应记录 score
解析错误，而不是静默写入默认 tier。

## 验收

- SCORE-AC01：mocked single-score 写回。
- SCORE-AC02：异常 AI 响应处理。
- SCORE-AC03：需要明确 opt-in 的付费 live-AI 质量审查。

当前 SCORE-AC03 的标准是 review-based：每个 live score 只要有合法 tier，且
解释具体、基于 JD/profile、没有捏造事实，就算通过。像“一个有摩擦的 SWE
职位到底该是 `mass_apply` 还是 `tailor`”这类问题属于 prompt tuning，不应作
为 acceptance 硬失败。

## 交接注意

- 不要把 dealbreaker filtering 加回 score。下游命令根据 tier 自己决定门槛。
- AI tier 与用户 tier 必须分开：`tierAi` 来自 scoring，`tierUser` 是手动
  override。
- 未来如果 prompt 调整导致 tier 行为变化，只有验收边界真的改变时才更新
  SCORE-AC03。
- SCORE-AC03 会花钱，并需要 `WOLF_ANTHROPIC_API_KEY` 或
  `WOLF_DEV_ANTHROPIC_API_KEY`；缺 key 只有在用户明确 opt-in 付费 AC 时才算
  FAIL。
