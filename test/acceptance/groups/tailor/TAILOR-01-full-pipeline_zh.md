# TAILOR-01 - 一个 Fixture Job 的完整 Tailor Pipeline

## 目的

验证 `wolf tailor full --job <jobId>` 会为一个 fixture job 跑完 analyst、resume writer、cover letter writer、renderer 和 DB path update。

## 覆盖

- `UC-06.1.1`
- `UC-07.1.1`
- `AC-04-1`
- `AC-04-2`
- `AC-05-1`
- `AC-05-2`

## 执行模式

`ai-reviewed`

## 成本 / 风险

- Cost: medium to high
- Risk: external-api
- Requires: `WOLF_ANTHROPIC_API_KEY` 或 `WOLF_DEV_ANTHROPIC_API_KEY`

## Workspace

使用 `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01`。

## Setup

group 内先运行一次 dev build：

```bash
npm run build:dev
```

初始化 workspace：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01 npm run wolf -- init --preset empty
```

填充共享的 NG SWE fixture（见 `test/fixtures/wolf-profile/`）。这是 wolf 的主用户
画像 —— F-1 OPT 上的 NG SWE,投后端方向。fixture loader 通过公开
`wolf profile` CLI 写入 `profile.toml`，包含 REQUIRED 的 Identity / Contact /
Job Preferences 字段、F-1 + H-1B sponsor 偏好、足够的 resume entries，以及至少
3 个已回答 builtin questions：

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01
bash test/fixtures/wolf-profile/scripts/populate_v2_profile.sh ng-swe "$WS"
WOLF_DEV_HOME="$WS" npm run wolf -- doctor
```

添加 fixture job 并捕获 `jobId`：

```bash
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 119)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01 npm run wolf -- add --title "Member of Technical Staff, Backend" --company "Fixture Company" --jd-text "$JD_TEXT"
```

## 步骤

运行：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01 npm run wolf -- tailor full --job <jobId>
```

然后检查生成的 job workspace：

```text
/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01/data/jobs/
```

## 预期产物

- `src/hint.md`
- `src/tailoring-brief.md`
- `src/resume.html`
- `resume.pdf`
- `src/cover_letter.html`
- `cover_letter.pdf`

## AI Review Rubric

以 [`../../reviewers/tailor-artifact-review.md`](../../reviewers/tailor-artifact-review.md)
作为基础 rubric。reviewer 必须按那个 prompt 的输入清单、review tasks 和 output
format 执行。下面只列本 case 独有的检查项，不要重复共享 rubric 已经覆盖的内容。

### 本 case 独有检查

- Resume 把 NG 候选人的偏后端材料按 JD 做剪裁:TypeScript / Go / Python
  服务、real-time data 工作、API 集成、Postgres / Redis / Airflow /
  WebSocket / gRPC 栈(按 JD 取舍)。剪裁应把 intern 体量的工作组织成连贯
  的后端故事,不能编造候选人没有的资深级别 ownership。
- Resume **不得**杜撰 pool 里没有的经验(没有 Java / Scala / Spark / Kafka,
  除非 JD 强行要求 —— 即便如此,也不得宣称 pool 没背书的实操)。
- Cover letter 中原样出现 `Fixture Company` 和
  `Member of Technical Staff, Backend`,并诚实地把候选人定位成 NG / 早期
  / 成长导向,而不是夸成资深。

## 通过标准

- 所有 setup 命令和 `tailor` 退出码都是 `0`。
- 每次 wolf 调用的 stderr 都出现 dev banner。
- `tailor` stdout 是 JSON，包含 `tailoredPdfPath` 和 `coverLetterPdfPath`。
- 所有预期产物都存在。
- AI review 结果是 `PASS` 或 `PASS_WITH_MINOR_IMPROVEMENTS`。
- 没有运行时文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`；忽略被 git
  跟踪的占位文件 `data/.gitkeep`。

## 报告要求

包含 command logs、fixture 路径、`jobId`、artifact paths、生成 HTML 的短摘录、AI review findings、bugs、improvements，以及 protected-path safety checks。
