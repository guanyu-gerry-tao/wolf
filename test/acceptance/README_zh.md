# Wolf Acceptance 测试套件

Acceptance tests 是已实现 wolf 行为的覆盖门禁。它应该回答："哪些 use case 和 acceptance criteria 真的被可运行测试覆盖了？"

Acceptance 比 smoke 更宽，可能包含 API 调用、AI 产物评审、浏览器自动化或人工批准边界。
只有文档明确标为 skipped-by-default 的 group 才默认跳过；否则缺少前置条件要报告为
failure 或 blocked run。

## 如何运行

把这段提示词复制给 Claude Code 或其他 agent runner：

```text
You are the Wolf Acceptance Test Orchestrator.

1. Read test/README.md and test/acceptance/README.md.
2. Run in the agent runner's normal execution mode. Use the least interactive
   path available: batch safe commands when allowed, request approval only when
   the runner requires it, continue after approval, and do not stop after
   returning only a plan.
3. Create a run id like acceptance-YYYYMMDD-HHMMSS.
4. Ensure /tmp/wolf-test/acceptance/<run-id>/workspaces/,
   /tmp/wolf-test/acceptance/<run-id>/reports/, and
   test/runs/<run-id>/reports/ exist. Do not delete them yet.
5. Identify every group folder under test/acceptance/groups/.
6. Skip groups marked skipped-by-default unless the user explicitly allows the
   required cost or risk.
7. Dispatch one sub-agent per runnable group in parallel.
8. Each group agent must:
   a. cd /Users/guanyutao/developers/personal-projects/wolf
   b. run npm run build:dev once for the group
   c. execute the group's README.md cases in order
   d. use WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/<workspace-id>
      for every wolf invocation
   e. write /tmp/wolf-test/acceptance/<run-id>/reports/<group-id>/report.md
   f. write command logs and lightweight artifact indexes under
      /tmp/wolf-test/acceptance/<run-id>/reports/<group-id>/
   g. capture stdout, stderr, exit code, generated artifact paths, bugs, and
      improvements
   h. return the report.md path in the final message
   i. if approval is denied or unavailable, return a BLOCKED summary instead of
      returning only a plan
9. After all groups report, copy /tmp/wolf-test/acceptance/<run-id>/reports/
   into test/runs/<run-id>/reports/.
10. Inspect each group report for required report sections. If a report is
   missing important evidence, ask that group agent to continue and complete the
   report. If the group agent is unavailable and the missing evidence is
   important for judging the result, rerun that group. Do not silently accept an
   incomplete report. A report that says SKIPPED because a required `WOLF_*` API
   key was not set must be re-classified as FAIL per the External API Policy
   below — name the missing key and what to configure.
11. Print per-group and overall PASS/FAIL/SKIPPED/BLOCKED counts, write
   test/runs/<run-id>/report.md, update test/runs/LATEST.md, and include a
   coverage summary by UC/AC id.
12. Do not delete /tmp/wolf-test/acceptance/<run-id>/ or test/runs/<run-id>/
   unless the user explicitly asks.
```

## Group 索引

| Group | 产品领域 | 默认模式 | 当前状态 |
|---|---|---|---|
| `add` | 手动结构化 job 录入 | automated | implemented |
| `hunt` | Job discovery providers 和 dedupe | automated / ai-reviewed | planned |
| `score` | Job scoring 和 hard filters | ai-reviewed | planned |
| `job-tracking` | 完整 `wolf job list` filters 和 output modes | automated | implemented |
| `tailor` | Resume 和 cover-letter 产物生成 | ai-reviewed | implemented |
| `fill` | 申请表填写 | fixture 用 automated，live submit 用 human-approval | planned |
| `reach` | Outreach draft 和 send 边界 | ai-reviewed / human-approval | planned |
| `mcp-contract` | MCP tool schemas 和结构化响应 | automated | planned |

## 覆盖规则

每个 group README 必须包含：

- 覆盖的 `UC-*` 和 `AC-*` id
- 明确的执行模式
- cost 和 risk 标签
- 运行前置条件
- case 步骤
- pass/fail rubric
- `ai-reviewed` 模式下的产物评审 rubric
- `human-guided` 或 `human-approval` 模式下的人工指导

如果某个 use case 已实现但没有 acceptance group，suite 应该明确写出这个缺口，而不是把缺口藏起来。

覆盖矩阵在 [COVERAGE.md](COVERAGE.md)。每次新增、删除、计划、实现或重新定义 case
时，都要同步更新它。

## AI 评审规则

对于主观产物，尽可能使用 AI review。例如 `tailor` 应该先生成 resume 或 cover letter，然后让 AI reviewer 检查：

- 相对 source resume pool 的事实准确性
- 与 JD 的相关性
- 格式和 PDF screenshot
- 是否有无依据的声称
- 如果失败，给出具体修复建议

reviewer 输出必须写进 group report。人类复核可以作为可选后续，但不应该是默认测试执行者。

Tailor artifacts 使用共享 reviewer prompt：
`test/acceptance/reviewers/tailor-artifact-review.md`，然后再叠加 case 文件里的
特殊检查点。

## 外部 API 规则

如果一个可运行、已实现的 group 需要外部 API key，缺少凭证是 `FAIL`，不是 skip。
报告必须写清楚缺哪个 key、哪个 case 因此无法运行，并告诉用户要配置什么。只有当
group/case 明确标为 skipped-by-default，或用户明确选择不运行这类风险/成本测试时，
才使用 `SKIPPED`。

外部 API 报告必须记录 provider、可用时的 model、相关 `WOLF_*` key 是否 `set` /
`not set`，以及 cost 或 rate-limit 观察。

## 真实外部副作用

真实外部副作用需要 `human-approval`，绝不能意外发生。例子包括：

- 提交真实 job application
- 在 live ATS 或雇主表单上点击最终 submit
- 发送 outreach email 或 LinkedIn message
- 修改外部账号、CRM records、calendar 或 mailbox
- 上传真实 resume 或 cover letter 到 live third-party site

Fixture pages、本地 browser automation、dry-run form mapping、生成 screenshots，以及
`/tmp/wolf-test/` 下的本地文件写入，都不算真实外部副作用。

## 短期计划

1. 保持 fixture scripts 作为 realistic pasted JD 和 resume input 的默认来源。
2. 保持 orchestrator 负责 report completeness。暂时不加 report checker script。
3. 所有 tailor AI review case 使用共享 tailor reviewer prompt。
4. case 在 planned 和 implemented 之间变化时，保持 `COVERAGE.md` 同步。
5. 对可运行、已实现 group，缺少必需 API credentials 视为 `FAIL`，并给用户清楚的修复说明。
