# TAILOR-02 - 分步 Brief、Resume 和 Cover Letter

## 目的

验证三个 step command 可以独立运行：`wolf tailor brief`、`wolf tailor resume` 和 `wolf tailor cover`。

## 覆盖

- `UC-06.1.1`
- `UC-07.1.1`
- `AC-04-1`
- `AC-05-1`

## 执行模式

`ai-reviewed`

## 成本 / 风险

- Cost: medium to high
- Risk: external-api
- Requires: `WOLF_ANTHROPIC_API_KEY` 或 `WOLF_DEV_ANTHROPIC_API_KEY`

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-02`。

## Setup

使用和 [TAILOR-01](TAILOR-01-full-pipeline_zh.md) 相同的 fixture profile、resume pool 和 add-job setup，但放在 TAILOR-02 workspace 下。

## 步骤

按顺序运行：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-02 npm run wolf -- tailor brief --job <jobId>
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-02 npm run wolf -- tailor resume --job <jobId>
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-02 npm run wolf -- tailor cover --job <jobId>
```

## 预期产物

- `brief` 后存在 `src/tailoring-brief.md`
- `resume` 后存在 `src/resume.html` 和 `resume.pdf`
- `cover` 后存在 `src/cover_letter.html` 和 `cover_letter.pdf`

## AI Review Rubric

以 [`../../reviewers/tailor-artifact-review.md`](../../reviewers/tailor-artifact-review.md)
作为基础 rubric。下面只列本 case 独有的检查项。

### 本 case 独有检查

- `resume.html` 和 `cover_letter.html` 都遵循已存在的
  `src/tailoring-brief.md`（同一个 candidate story、同一组 JD themes）；
  `tailor resume` 和 `tailor cover` 不会重新生成 brief。

## 通过标准

- 三个命令退出码都是 `0`。
- 每次 wolf 调用的 stderr 都出现 dev banner。
- 每个命令 stdout 都是 JSON，包含该 step 的预期 output path。
- 每个 step 后对应产物存在。
- `resume` 和 `cover` 使用同一个已有的 `tailoring-brief.md`。
- 共享 reviewer rubric 返回 `PASS` 或 `PASS_WITH_MINOR_IMPROVEMENTS`，且
  上面的本 case 独有检查通过。
- 没有文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`。

## 报告要求

包含 command logs、`jobId`、每个 JSON response 的 output paths、artifact existence checks、brief excerpt、AI review findings 和 safety checks。

