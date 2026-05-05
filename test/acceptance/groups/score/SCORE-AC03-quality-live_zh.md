# SCORE-AC03 - 在线 AI 打分质量（付费、默认跳过）

## 目的

抽样验证生产打分 prompt 在两种 persona × 三个差异化 JD 上得到的 tier 区间符
合人类直觉。本 case 是本组中唯一调用真实 Claude API 的：付费、默认跳过，
只有用户明确授权才运行。

## 覆盖

- `UC-03.1.1`（在线单职位评分）
- 间接覆盖：prompt 质量与 tier 区间标定。

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
# 选三条覆盖 tier 区间的 JD：明确对齐（Software Engineer）、相邻但摩擦较多
#（System Administrator）、明显错位的非工程（Product Designer）。CSV 行 id
# 若变动需要相应更新。
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
对比同样 JD 在不同 persona 下的得分差异。

## AI Review Rubric

使用 [`../../reviewers/score-artifact-review.md`](../../reviewers/score-artifact-review.md)。

### 本 case 的额外检查

- 明显对齐的 backend/SWE JD 在 `ng-swe` 下应为 `tailor` 或 `invest`。
- 明显错位的非工程 JD 在 `ng-swe` 下应为 `skip`。
- 边缘 / 相邻 JD 应为 `skip` 或 `mass_apply`，且 justification 必须说出具体
  摩擦点，而不是泛泛夸奖。
- 同一组 JD 跑在 `swe-mid` 上至少应有一条得分区间相对 `ng-swe` 改变 —— 否则说明 prompt 在忽略 profile。
- justification 不允许提到 persona `profile.toml` 里没有的事实（例如 "candidate has 10 years of Kotlin experience"）。

## 通过标准

- 所有 wolf 命令以 `0` 退出。
- tier 区间符合上述 rubric。
- Reviewer 结论为 `PASS` 或 `PASS_WITH_MINOR_IMPROVEMENTS`。

## 报告要求

记录每个 `Job.tierAi` + `Job.scoreJustification`、persona 名称、JD 行 id，
以及 AI reviewer 的输出。
