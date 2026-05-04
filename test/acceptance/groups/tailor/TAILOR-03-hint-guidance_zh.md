# TAILOR-03 - Analyst Hint 被写入并生效

## 目的

验证 `--hint` 会写入 `src/hint.md`，analysis 前会剥离 comment header，并能引导 analyst brief。

## 覆盖

- `UC-06.1.1`
- `UC-06.1.2`

## 执行模式

`ai-reviewed`

## 成本 / 风险

- Cost: medium
- Risk: external-api
- Requires: `WOLF_ANTHROPIC_API_KEY` 或 `WOLF_DEV_ANTHROPIC_API_KEY`

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-03`。

## Setup

使用和 [TAILOR-01](TAILOR-01-full-pipeline_zh.md) 相同的 CLI-populated fixture
profile、resume content 和 add-job setup，但放在 TAILOR-03 workspace 下。

## 步骤

运行：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-03 npm run wolf -- tailor brief --job <jobId> --hint "Prioritize PostgreSQL performance and CI runbooks. De-emphasize frontend dashboards."
```

然后检查：

```text
data/jobs/<job-dir>/src/hint.md
data/jobs/<job-dir>/src/tailoring-brief.md
```

## AI Review Rubric

以 [`../../reviewers/tailor-artifact-review.md`](../../reviewers/tailor-artifact-review.md)
作为基础 rubric。注意：本 case 只生成 `hint.md` 和 `tailoring-brief.md`，resume
和 cover letter 产物可能不存在，shared rubric 中依赖缺失产物的部分在报告里
标 `N/A` 即可。

### 本 case 独有检查

- `tailoring-brief.md` 更强调 PostgreSQL performance 和 CI runbooks，
  而不是 frontend dashboards（hint 应当能明显引导 brief）。
- `hint.md` 包含自解释 comment header，并原样含有传入的 hint 字符串
  （包括大小写和标点）。

## 通过标准

- 命令退出码是 `0`。
- stderr 出现 dev banner。
- `hint.md` 存在。
- `tailoring-brief.md` 存在。
- 共享 reviewer rubric 返回 `PASS` 或 `PASS_WITH_MINOR_IMPROVEMENTS`，且
  上面两条本 case 独有检查通过。
- 没有运行时文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`；忽略被 git
  跟踪的占位文件 `data/.gitkeep`。

## 报告要求

包含 command logs、`jobId`、hint path、brief path、两个文件的短摘录、AI review findings 和 safety checks。
