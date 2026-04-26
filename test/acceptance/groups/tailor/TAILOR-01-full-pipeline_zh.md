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
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01 npm run wolf -- init --dev --empty
```

填充 default profile 和 resume pool：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01 npm run wolf -- profile set name "Test Candidate"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01 npm run wolf -- profile set email "candidate@example.test"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01 npm run wolf -- profile set targetRoles "Backend Engineer, Data Infrastructure Engineer"
```

编辑 `/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01/profiles/default/resume_pool.md`，只写入 fixture facts。Pool 内容必须**足够密**，能让定制后的单页 resume 在默认字号/行距下填满整页 —— 过稀的 pool 会被渲染器的 underflow 守卫正确拒绝，因此下面这份 fixture 故意按一份真实中级工程师 resume 的体量给出：

```md
# Test Candidate Resume Pool

## Experience

### Backend Engineer - Northwind Systems
*2022 - 2025*
- Built Java and Scala backend services running 200+ event-processing workflows.
- Improved Spark data pipelines used by analytics and operations teams; cut nightly batch runtime by 38%.
- Designed internal REST APIs and on-call runbooks for distributed job processing.
- Migrated legacy Hadoop jobs to Spark Structured Streaming with zero data loss.

### Data Platform Engineer - Vega Logistics
*2020 - 2022*
- Owned the streaming ingestion path on Kafka; sustained 12k events/sec at p99 < 80ms.
- Built a Postgres CDC pipeline replicating 40+ tables to a Snowflake warehouse.
- Authored the team's data-quality framework (Great Expectations + custom Scala validators).

### Software Engineer Intern - Atlas Tools
*2019*
- Built Java API integrations between internal reporting tools and a third-party billing system.
- Wrote integration tests for batch processing endpoints; raised coverage from 41% to 78%.

## Projects

### Internal Job Scheduler
*2024*
- Lightweight cron replacement for ad-hoc team automations; Go + SQLite, ~600 LOC.
- Replaced four bespoke scripts and reduced on-call paging by ~30%.

### Open-Source Spark Connector
*2023*
- Maintainer of a small Spark connector for an internal columnar format.
- Two minor releases shipped, used by three downstream teams.

## Education

### B.S. Computer Science - Northwind State University
*2015 - 2019*

## Skills

Java, Scala, Spark, Hadoop, Kafka, PostgreSQL, Snowflake, REST API design, distributed systems, Go
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

- Resume 强调 backend systems、data infrastructure、Java/Scala、Spark 或
  Hadoop-style pipeline work、API design 和 distributed processing。
- Cover letter 中原样出现 `Fixture Company` 和
  `Member of Technical Staff, Backend`。

## 通过标准

- 所有 setup 命令和 `tailor` 退出码都是 `0`。
- 每次 wolf 调用的 stderr 都出现 dev banner。
- `tailor` stdout 是 JSON，包含 `tailoredPdfPath` 和 `coverLetterPdfPath`。
- 所有预期产物都存在。
- AI review 结果是 `PASS` 或 `PASS_WITH_MINOR_IMPROVEMENTS`。
- 没有文件写入 `~/wolf`、`~/wolf-dev` 或 repo 内 `data/`。

## 报告要求

包含 command logs、fixture 路径、`jobId`、artifact paths、生成 HTML 的短摘录、AI review findings、bugs、improvements，以及 protected-path safety checks。
