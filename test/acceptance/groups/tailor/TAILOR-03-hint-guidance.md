# TAILOR-03 - Analyst Hint Is Written And Used

## Purpose

Verify that `--hint` writes `src/hint.md`, strips comment headers before
analysis, and steers the analyst brief.

## Covers

- `UC-06.1.1`
- `UC-06.1.2`

## Execution Mode

`ai-reviewed`

## Cost / Risk

- Cost: medium
- Risk: external-api
- Requires: `WOLF_ANTHROPIC_API_KEY` or `WOLF_DEV_ANTHROPIC_API_KEY`

## Workspace

Use `WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-03`.

## Setup

Use the same CLI-populated fixture profile, resume content, and add-job setup as
[TAILOR-01](TAILOR-01-full-pipeline.md), but under the TAILOR-03 workspace.

## Steps

Run:

```bash
WOLF_DEV_HOME=/tmp/wolf-test/acceptance/<run-id>/workspaces/tailor-TAILOR-03 npm run wolf -- tailor brief --job <jobId> --hint "Prioritize PostgreSQL performance and CI runbooks. De-emphasize frontend dashboards."
```

Then inspect:

```text
data/jobs/<job-dir>/src/hint.md
data/jobs/<job-dir>/src/tailoring-brief.md
```

## AI Review Rubric

Use [`../../reviewers/tailor-artifact-review.md`](../../reviewers/tailor-artifact-review.md)
as the base rubric. Note: this case generates `hint.md` and `tailoring-brief.md`
only — resume and cover letter artifacts may be absent. Skip shared rubric
sections that depend on missing artifacts and mark them `N/A` in the report.

### Case-specific checks

- `tailoring-brief.md` emphasizes PostgreSQL performance and CI runbooks more
  than frontend dashboards (the hint should visibly steer the brief).
- `hint.md` contains the self-documenting comment header and the provided hint
  string verbatim, including casing and punctuation.

## Pass Criteria

- Command exits `0`.
- Dev banner appears on stderr.
- `hint.md` exists.
- `tailoring-brief.md` exists.
- Shared reviewer rubric returns `PASS` or `PASS_WITH_MINOR_IMPROVEMENTS` and
  both case-specific checks above pass.
- No runtime files are written under `~/wolf`, `~/wolf-dev`, or repo-local
  `data/` (ignore the tracked `data/.gitkeep` placeholder).

## Report Requirements

Include command logs, `jobId`, hint path, brief path, short excerpts from both
files, AI review findings, and safety checks.
