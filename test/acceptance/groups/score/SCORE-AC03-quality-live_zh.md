# SCORE-AC03 - 在线 AI 打分质量（付费、默认跳过）

## 目的

抽样验证生产打分 prompt 能否对几条真实 fixture JD 给出已写回、可审查的
tier verdict，并附带有根据的解释。本 case 是本组中唯一调用真实 Claude API
的：付费、默认跳过，只有用户明确授权才运行。

## 覆盖

- `UC-03.1.1`（在线单职位评分）
- 间接覆盖：prompt 输出质量与解释是否有根据。

## 执行方式

`ai-reviewed`，默认 `SKIP`。仅在用户明确授权付费运行。

## 成本 / 风险

- 成本：中（每 persona 3 次 Sonnet 调用 × 2 personas = 6 次）。
- 风险：external-api。
- 必需：`WOLF_ANTHROPIC_API_KEY` 或 `WOLF_DEV_ANTHROPIC_API_KEY`。

## Workspace

`WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC03`

## Setup

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/score-AC03
WOLF_DEV_HOME="$WS" npm run wolf -- init --dev --empty
bash test/fixtures/wolf-profile/scripts/populate_v2_profile.sh ng-swe "$WS"
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
# 选三条不同匹配形态的 fixture JD：Software Engineer、System Administrator
# 与 Product Designer。CSV 行 id 若变动需要相应更新。
for ROW in 523 172 288; do
  JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id "$ROW")"
  TITLE="Fixture Job $ROW"
  WOLF_DEV_HOME="$WS" npm run wolf -- add --title "$TITLE" --company "Fixture Co" --jd-text "$JD_TEXT"
done
```

## 步骤

对每个 tracked job 运行同步打分并记录输出：

```bash
WOLF_DEV_HOME="$WS" npm run wolf -- job list --status new --limit 50
# 对每个 id：
WOLF_DEV_HOME="$WS" npm run wolf -- score --single --jobs "<JOB_ID>"
```

随后用 `swe-mid` persona（建议另开 workspace）重复整个流程，便于 reviewer
对比解释是否考虑了当前 persona。

## AI Review Rubric

使用 [`../../reviewers/score-artifact-review.md`](../../reviewers/score-artifact-review.md)。

### 本 case 的额外检查

- 每个已评分 job 都写回 `Job.tierAi`，并且该值对应 `skip`、`mass_apply`、
  `tailor` 或 `invest` 之一。
- 每个已评分 job 都有非空 `Job.scoreJustification`，且包含 `## Tier`、
  `## Pros`、`## Cons`。
- justification 应该基于 JD 与 persona：引用角色、技术栈、薪资、地点、
  remote 偏好、sponsorship 或明确 profile preference 等具体信号。
- 只要解释能合理支撑该 tier，reviewer 可以接受任意 tier。例如相关 SWE
  JD 如果缺薪资、签证不明确、技术栈部分错位或 logistics 有摩擦，也可以是
  `mass_apply`。
- 只有 tier 为空 / 非法、解释缺失或泛泛而谈、解释捏造事实，或 verdict
  明显不合理（例如非工程 JD 在没有具体依据时被推到高 tier）时才判 FAIL。

## 通过标准

- 所有 wolf 命令以 `0` 退出。
- 每个已评分 job 都写回合法 tier 与有根据的解释。
- Reviewer 结论为 `PASS` 或 `PASS_WITH_MINOR_IMPROVEMENTS`。

## 报告要求

记录每个 `Job.tierAi` + `Job.scoreJustification`、persona 名称、JD 行 id，
以及 AI reviewer 的输出。
