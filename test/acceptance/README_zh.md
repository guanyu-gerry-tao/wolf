# Wolf Acceptance 测试套件

Acceptance tests 是已实现 wolf 行为的覆盖门禁。它应该回答："哪些 use case 和 acceptance criteria 真的被可运行测试覆盖了？"

Acceptance 比 smoke 更宽，可能包含 API 调用、AI 产物评审、浏览器自动化或人工批准边界。高成本或高风险 group 默认跳过。

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
4. Ensure /tmp/wolf-test/acceptance/<run-id>/workspaces/ and
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
   e. write test/runs/<run-id>/reports/<group-id>/report.md
   f. capture stdout, stderr, exit code, generated artifact paths, bugs, and
      improvements
   g. if approval is denied or unavailable, write a BLOCKED report instead of
      returning only a plan
9. After all groups report, print per-group and overall PASS/FAIL/SKIPPED/BLOCKED
   counts, write test/runs/<run-id>/report.md, update test/runs/LATEST.md, and
   include a coverage summary by UC/AC id.
10. Do not delete /tmp/wolf-test/acceptance/<run-id>/ or test/runs/<run-id>/
   unless the user explicitly asks.
```

## Group 索引

| Group | 产品领域 | 默认模式 | 当前状态 |
|---|---|---|---|
| `hunt` | Job discovery providers 和 dedupe | automated / ai-reviewed | planned |
| `score` | Job scoring 和 hard filters | ai-reviewed | planned |
| `job-tracking` | 完整 `wolf job list` filters 和 output modes | automated | planned |
| `tailor` | Resume 和 cover-letter 产物生成 | ai-reviewed | planned |
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

## AI 评审规则

对于主观产物，尽可能使用 AI review。例如 `tailor` 应该先生成 resume 或 cover letter，然后让 AI reviewer 检查：

- 相对 source resume pool 的事实准确性
- 与 JD 的相关性
- 格式和 PDF screenshot
- 是否有无依据的声称
- 如果失败，给出具体修复建议

reviewer 输出必须写进 group report。人类复核可以作为可选后续，但不应该是默认测试执行者。
