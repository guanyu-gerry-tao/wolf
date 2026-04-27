# TAILOR-01 - Full Tailor Pipeline For One Fixture Job

## Purpose

Verify that `wolf tailor full --job <jobId>` runs the analyst, resume writer, cover
letter writer, renderer, and DB path update for one fixture job.

## Covers

- `UC-06.1.1`
- `UC-07.1.1`
- `AC-04-1`
- `AC-04-2`
- `AC-05-1`
- `AC-05-2`

## Execution Mode

`ai-reviewed`

## Cost / Risk

- Cost: medium to high
- Risk: external-api
- Requires: `WOLF_ANTHROPIC_API_KEY` or `WOLF_DEV_ANTHROPIC_API_KEY`

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01`.

## Setup

Run the dev build once for the group:

```bash
npm run build:dev
```

Initialize the workspace:

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01 npm run wolf -- init --dev --empty
```

Populate the default profile and resume pool with truthful fixture content.
Profile is now markdown — overwrite `profile.md` directly (the `wolf profile
set` CLI no longer exists; profile fields are edited in the file):

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01
cat > "$WS/profiles/default/profile.md" <<'EOF'
# default

# Identity

## Legal first name
Test

## Legal last name
Candidate

# Contact

## Email
candidate@example.test

## Phone
+1 555 010 0100

# Job Preferences

## Target roles
Backend Engineer, Data Infrastructure Engineer

## Target locations
Remote-US

## Relocation preference — where are you actually willing to live?
> [!IMPORTANT]
> within current metro area: yes
> within current state: yes
> cross-country: yes
> international: no
EOF
```

Edit `/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01/profiles/default/resume_pool.md`
to contain only fixture facts. The pool must be dense enough that a tailored
single-page resume can fill the page at default font/spacing — too-thin pools
are correctly rejected by the renderer's underflow guard, so the fixture below
is intentionally a realistic mid-career resume's worth of material.

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

Add the fixture job and capture `jobId`:

```bash
JD_FIXTURE=test/fixtures/jd/raw/computer-related-job-postings-cc0.csv
JD_TEXT="$(python3 test/fixtures/jd/scripts/sample_raw_jd.py "$JD_FIXTURE" --row-id 119)"
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01 npm run wolf -- add --title "Member of Technical Staff, Backend" --company "Fixture Company" --jd-text "$JD_TEXT"
```

## Steps

Run:

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01 npm run wolf -- tailor full --job <jobId>
```

Then inspect the generated job workspace under:

```text
/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01/data/jobs/
```

## Expected Artifacts

- `src/hint.md`
- `src/tailoring-brief.md`
- `src/resume.html`
- `resume.pdf`
- `src/cover_letter.html`
- `cover_letter.pdf`

## AI Review Rubric

Use [`../../reviewers/tailor-artifact-review.md`](../../reviewers/tailor-artifact-review.md)
as the base rubric. The reviewer must follow that prompt for inputs, review
tasks, and output format. The case-specific checks below are added on top of the
shared rubric — do not duplicate the shared checks here.

### Case-specific checks

- Resume emphasizes backend systems, data infrastructure, Java/Scala, Spark or
  Hadoop-style pipeline work, API design, and distributed processing.
- Cover letter names `Fixture Company` and `Member of Technical Staff, Backend`
  exactly as written.

## Pass Criteria

- All setup commands and `tailor` exit `0`.
- Dev banner appears on stderr for every wolf invocation.
- `tailor` stdout is JSON containing `tailoredPdfPath` and `coverLetterPdfPath`.
- All expected artifacts exist.
- AI review result is `PASS` or `PASS_WITH_MINOR_IMPROVEMENTS`.
- No files are written under `~/wolf`, `~/wolf-dev`, or repo-local `data/`.

## Report Requirements

Include command logs, fixture path, `jobId`, artifact paths, short excerpts from
generated HTML files, AI review findings, bugs, improvements, and protected-path
safety checks.
