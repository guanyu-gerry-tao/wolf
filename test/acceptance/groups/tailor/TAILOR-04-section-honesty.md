# TAILOR-04 - Section Honesty And Pool-Driven Ordering

## Purpose

Verify that the resume writer (a) never invents an entire section the resume
pool lacks, and (b) emits sections in the exact order they appear in the pool —
even when that order contradicts conventional resume layout.

This case is the regression guard for Bug B3 (writer fabricated
`Education: BS, Computer Science` when the pool had no education entry).

## Covers

- `UC-06.1.1`
- `AC-04-2` — strengthened: factual accuracy now also covers "no invented
  sections" and "section order follows pool"

## Execution Mode

`ai-reviewed`

## Cost / Risk

- Cost: medium (two `wolf tailor full --job <jobId>` runs against the live
  Anthropic API)
- Risk: external-api
- Requires: `WOLF_ANTHROPIC_API_KEY` or `WOLF_DEV_ANTHROPIC_API_KEY`. Missing
  key is `FAIL`, not `SKIPPED`.

## Workspace

Each sub-case uses its own workspace under
`/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-<sub>`.

## Shared Setup

Run the dev build once for the whole group:

```bash
npm run build:dev
```

For each sub-case, initialize a separate workspace and drop in the shared
mid-career SWE fixture (same persona TAILOR-01 uses):

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-<sub> \
  npm run wolf -- init --dev --empty
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-<sub>
cp -r test/fixtures/wolf-profile/swe-mid/* "$WS/profiles/default/"
```

Add the same fixture job (row 119 of the JD CSV) used by TAILOR-01:

```bash
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py \
  test/fixtures/jd/raw/computer-related-job-postings-cc0.csv --row-id 119)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-<sub> \
  npm run wolf -- add --title "Member of Technical Staff, Backend" \
  --company "Fixture Company" --jd-text "$JD_TEXT"
```

The per-sub-case `resume_pool.md` is overwritten in step 1 of each sub-case
below (the init template is replaced).

## Sub-case 4a — Pool with no Education

**Pool content** — overwrite
`/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-4a/profiles/default/resume_pool.md`
with:

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

**Note:** intentionally NO `## Education` section. The candidate is a
bootcamp / self-taught backend engineer with no degree to list. The pool is
otherwise dense enough that the resulting resume can fill a single page on
Experience + Projects + Skills alone — so an underflow `CannotFillError` here
would correctly be treated as a fixture density bug, not a renderer bug.

**Run:**

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-4a \
  npm run wolf -- tailor full --job <jobId>
```

**Pass criteria for 4a:**

- `tailor full` exits `0`.
- `src/resume.html` exists and is valid HTML.
- `src/resume.html` contains `<h2>Experience</h2>`, `<h2>Projects</h2>`,
  `<h2>Skills</h2>` (in some form — exact title preserved from the pool).
- `src/resume.html` does **NOT** contain any `<h2>` whose text contains
  "Education" (case-insensitive). No degree, no school, no "Education TBD"
  placeholder.
- AI reviewer (using
  [`../../reviewers/tailor-artifact-review.md`](../../reviewers/tailor-artifact-review.md))
  confirms zero Education-related fabrication. No "BS", no "Bachelor", no
  university name appears anywhere in the resume.
- No files written under `~/wolf`, `~/wolf-dev`, or repo-local `data/`.

## Sub-case 4b — Pool with reordered sections (Skills first, Education last)

**Pool content** — overwrite
`/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-4b/profiles/default/resume_pool.md`
with:

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

**Note:** sections are intentionally in non-conventional order:
`Skills → Projects → Experience → Education`. Conventional resume layout would
put Experience first or Education last; this pool puts Skills first and
Experience third.

**Run:**

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-04-4b \
  npm run wolf -- tailor full --job <jobId>
```

**Pass criteria for 4b:**

- `tailor full` exits `0`.
- `src/resume.html` exists and is valid HTML.
- The four `<h2>` section headers in `src/resume.html` appear in the
  ORDER `Skills → Projects → Experience → Education` (matching the pool).
  Concretely: when scanning the file top-to-bottom, the first `<h2>` whose text
  contains "Skill" appears before the first `<h2>` whose text contains
  "Project", which appears before the first `<h2>` whose text contains
  "Experience", which appears before the first `<h2>` whose text contains
  "Education".
- AI reviewer confirms no reordering — the writer did NOT rearrange sections
  to follow conventional resume layout.
- No files written under `~/wolf`, `~/wolf-dev`, or repo-local `data/`.

## AI Review Rubric

Use [`../../reviewers/tailor-artifact-review.md`](../../reviewers/tailor-artifact-review.md)
as the base rubric. Note: this case primarily tests structural honesty, not
deep content quality — sections of the shared rubric that depend on the cover
letter may be marked `N/A` if the run only generated the resume.

### Case-specific checks

- (4a) The generated `resume.html` contains exactly the sections present in
  the pool (Experience / Projects / Skills) and NO additional section. If any
  Education-shaped content is present (degree, school, dates, the word
  "Bachelor", a university name), this is a hard FAIL — the writer fabricated
  data not in the pool.
- (4b) The four sections appear in the resume in the exact order Skills →
  Projects → Experience → Education. Any other order (e.g. Experience first
  to match convention) is a hard FAIL — the writer must respect the pool's
  ordering authority.

## Report Requirements

For each sub-case include: command logs, `jobId`, the pool content used,
the generated `resume.html` (full or excerpts showing all `<h2>` sections in
order), reviewer findings, and protected-path safety checks.
