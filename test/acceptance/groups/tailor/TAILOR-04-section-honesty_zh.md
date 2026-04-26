# TAILOR-04 - Section 诚实性与 pool 驱动的顺序

## 目的

验证 resume writer 满足两条承诺：(a) 绝不杜撰 pool 里没有的整段 section；
(b) 严格按 pool 中 section 出现顺序输出，**即使**这个顺序违背"常规"简历布局。

本 case 是 Bug B3 的回归守卫（writer 在 pool 无 Education 时杜撰了
`Education: BS, Computer Science`）。

## 覆盖

- `UC-06.1.1`
- `AC-04-2`（强化版：事实准确性现在还覆盖"不杜撰整段 section"和"section 顺序跟随 pool"）

## 执行模式

`ai-reviewed`

## 成本 / 风险

- Cost: medium（两次 `wolf tailor full --job <jobId>` 真调 Anthropic API）
- Risk: external-api
- Requires: `WOLF_ANTHROPIC_API_KEY` 或 `WOLF_DEV_ANTHROPIC_API_KEY`。
  缺 key 是 `FAIL`，不是 `SKIPPED`。

## Workspace

每个 sub-case 用独立 workspace：
`/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-<sub>`。

## 共享 Setup

整个 group 跑一次 dev build：

```bash
npm run build:dev
```

每个 sub-case 都先初始化独立 workspace 并配置和 TAILOR-01 一致的 fixture profile：

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-<sub> \
  npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-<sub> \
  npm run wolf -- profile set name "Test Candidate"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-<sub> \
  npm run wolf -- profile set email "candidate@example.test"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-<sub> \
  npm run wolf -- profile set targetRoles "Backend Engineer"
```

添加和 TAILOR-01 相同的 fixture job（JD CSV 第 119 行）：

```bash
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py \
  test/fixtures/jd/raw/computer-related-job-postings-cc0.csv --row-id 119)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-<sub> \
  npm run wolf -- add --title "Member of Technical Staff, Backend" \
  --company "Fixture Company" --jd-text "$JD_TEXT"
```

每个 sub-case 在第 1 步会**覆盖**生成的 `resume_pool.md`，下面给出具体内容。

## Sub-case 4a — Pool 缺 Education

**Pool 内容** —— 覆盖
`/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-4a/profiles/default/resume_pool.md`：

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

## Skills

Java, Scala, Spark, Hadoop, Kafka, PostgreSQL, Snowflake, REST API design, distributed systems, Go
```

**注意**：故意不放 `## Education` section。设定是 bootcamp / 自学背景，无学位。Pool 其他部分密度足够，定制后的 resume 仅靠 Experience + Projects + Skills 就能填满一页 —— 所以这里如果出 underflow `CannotFillError` 必然是 fixture 密度不够，不是渲染器 bug。

**运行：**

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-4a \
  npm run wolf -- tailor full --job <jobId>
```

**4a 通过标准：**

- `tailor full` 退出码 `0`。
- `src/resume.html` 存在且是合法 HTML。
- `src/resume.html` 含 `<h2>Experience</h2>`、`<h2>Projects</h2>`、
  `<h2>Skills</h2>`（标题原样保留 pool 写法）。
- `src/resume.html` **不含**任何文本含 "Education"（不区分大小写）的 `<h2>`。
  没有学位、没有学校、没有 "Education TBD" 占位符。
- AI reviewer（使用
  [`../../reviewers/tailor-artifact-review.md`](../../reviewers/tailor-artifact-review.md)）
  确认整份 resume 任何位置都没有 Education 相关杜撰：没有 "BS"、没有 "Bachelor"、没有任何大学名。
- 无文件写入 `~/wolf`、`~/wolf-dev` 或 repo `data/`。

## Sub-case 4b — Pool 顺序乱（Skills 第一、Education 最后）

**Pool 内容** —— 覆盖
`/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-4b/profiles/default/resume_pool.md`：

```md
# Test Candidate Resume Pool

## Skills

Java, Scala, Spark, Hadoop, Kafka, PostgreSQL, Snowflake, REST API design, distributed systems, Go

## Projects

### Internal Job Scheduler
*2024*
- Lightweight cron replacement for ad-hoc team automations; Go + SQLite, ~600 LOC.
- Replaced four bespoke scripts and reduced on-call paging by ~30%.

### Open-Source Spark Connector
*2023*
- Maintainer of a small Spark connector for an internal columnar format.

## Experience

### Backend Engineer - Northwind Systems
*2022 - 2025*
- Built Java and Scala backend services running 200+ event-processing workflows.
- Improved Spark data pipelines used by analytics and operations teams; cut nightly batch runtime by 38%.
- Designed internal REST APIs and on-call runbooks for distributed job processing.

### Data Platform Engineer - Vega Logistics
*2020 - 2022*
- Owned the streaming ingestion path on Kafka; sustained 12k events/sec at p99 < 80ms.
- Built a Postgres CDC pipeline replicating 40+ tables to a Snowflake warehouse.

### Software Engineer Intern - Atlas Tools
*2019*
- Built Java API integrations between internal reporting tools and a third-party billing system.

## Education

### B.S. Computer Science - Northwind State University
*2015 - 2019*
```

**注意**：section 顺序刻意非常规：`Skills → Projects → Experience → Education`。
"惯例"会把 Experience 放第一或 Education 放最后，但本 pool 把 Skills 放第一、
Experience 放第三。

**运行：**

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-4b \
  npm run wolf -- tailor full --job <jobId>
```

**4b 通过标准：**

- `tailor full` 退出码 `0`。
- `src/resume.html` 存在且是合法 HTML。
- 四个 `<h2>` section 标题在 `src/resume.html` 中按
  `Skills → Projects → Experience → Education` 的顺序出现（跟随 pool）。
  具体：从上到下扫描文件，第一个文本含 "Skill" 的 `<h2>` 出现在
  第一个含 "Project" 的之前，含 "Project" 的出现在含 "Experience" 的之前，
  含 "Experience" 的出现在含 "Education" 的之前。
- AI reviewer 确认 writer 没有重排 —— 没有按"惯例"（如把 Experience 提前）调整顺序。
- 无文件写入 `~/wolf`、`~/wolf-dev` 或 repo `data/`。

## AI Review Rubric

以 [`../../reviewers/tailor-artifact-review.md`](../../reviewers/tailor-artifact-review.md)
作为基础 rubric。注意：本 case 重点测结构诚实性，非内容深度，cover letter
相关检查项如果该次只生成了 resume，可在报告里标 `N/A`。

### 本 case 独有检查

- (4a) 生成的 `resume.html` 中只含 pool 实际存在的 section（Experience / Projects /
  Skills），**没有**任何额外 section。如果出现任何 Education 相关内容（学位、学校、
  日期、"Bachelor" 字样、大学名），直接 FAIL —— writer 杜撰了 pool 不存在的数据。
- (4b) 四个 section 在 resume 中按 Skills → Projects → Experience → Education 顺序
  出现。任何其他顺序（如把 Experience 移到第一位以贴合"惯例"）直接 FAIL ——
  writer 必须尊重 pool 的排序权威。

## 报告要求

每个 sub-case 包含：command logs、`jobId`、所用 pool 内容、生成的 `resume.html`
（完整或显示所有 `<h2>` section 顺序的摘录）、reviewer 结论，以及保护路径 safety check。
