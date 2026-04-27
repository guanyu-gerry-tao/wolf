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

Drop in the shared mid-career SWE fixture (see
`test/fixtures/wolf-profile/swe-mid/`). The fixture has a populated
`profile.md` (REQUIRED Identity / Contact / Job Preferences fields filled)
and a realistic mid-career `resume_pool.md` dense enough that the renderer's
underflow guard accepts the resulting single-page resume:

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-01
cp -r test/fixtures/wolf-profile/swe-mid/* "$WS/profiles/default/"
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
