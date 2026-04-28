# Acceptance Coverage Matrix

This matrix maps implemented or planned user-facing behavior to acceptance test
groups and cases. It is the first place to check when asking "is this use case
covered?"

AC text below is normative — pulled verbatim from
[`docs/requirements/ACCEPTANCE_CRITERIA.md`](../../docs/requirements/ACCEPTANCE_CRITERIA.md).
UC ids reference [`docs/requirements/USE_CASES.md`](../../docs/requirements/USE_CASES.md).

## Implemented Coverage

### Add (`wolf add`)

| Requirement | Behavior | Acceptance Coverage |
|---|---|---|
| `UC-02.2.1` | Add a structured job from pasted JD data (CLI) | `add/ADD-01`, `add/ADD-02` |
| `AC-10-1` | `wolf_add` returns `jobId` (CLI-equivalent shape only — MCP variant `UC-02.2.2` not tested) | `add/ADD-01` |

### Tailor (`wolf tailor`)

| Requirement | Behavior | Acceptance Coverage |
|---|---|---|
| `UC-06.1.1` | Tailor Resume (CLI) | `tailor/TAILOR-01`, `tailor/TAILOR-02`, `tailor/TAILOR-03`, `tailor/TAILOR-04` |
| `UC-07.1.1` | Generate Cover Letter (CLI) | `tailor/TAILOR-01`, `tailor/TAILOR-02` |
| `AC-04-1` | Tailoring brief, `resume.html`, and `resume.pdf` written to workspace; resume PDF path recorded on Job row | `tailor/TAILOR-01`, `tailor/TAILOR-02` |
| `AC-04-2` | Factual accuracy preserved — no fabricated companies/dates/metrics/claims, no invented sections, section order follows the pool | `tailor/TAILOR-01`, `tailor/TAILOR-04` |
| `AC-05-1` | `cover_letter.html` and `cover_letter.pdf` written alongside tailored resume; cover letter PDF path recorded on Job row | `tailor/TAILOR-01`, `tailor/TAILOR-02` |
| `AC-05-2` | Cover letter includes correct role title and company name from JD | `tailor/TAILOR-01` |
| Analyst hint flow (`--hint` writes `src/hint.md`, steers analyst brief) | Sub-feature of `UC-06.1.1`; no canonical AC id assigned | `tailor/TAILOR-03` |

### Job tracking (`wolf status` + `wolf job list`)

| Requirement | Behavior | Acceptance Coverage |
|---|---|---|
| `AC-08-1` | `wolf status` prints one count per registered module, one per line | `job-tracking` (group-level) |
| `AC-08-2` | `wolf status` resilient aggregation — failed counter shows `0 [error: ...]` inline | `job-tracking` (group-level) |
| `AC-08-3` | `wolf job list` default table output (id / company / title / status / score; limit 20) | `job-tracking/JOB-01` |
| `AC-08-4` | Structured filters combine with AND semantics | `job-tracking/JOB-01` |
| `AC-08-5` | `--search` matches title OR company OR location (case-insensitive substring) | `job-tracking/JOB-01` |
| `AC-08-6` | Repeatable `--search` ORs across terms | `job-tracking/JOB-01` |
| `AC-08-6b` | Search composes with structured filters via top-level AND | `job-tracking/JOB-01` |
| `AC-08-6c` | Search terms accept SQL `LIKE` wildcards `%` / `_` | `job-tracking` (group-level only — no dedicated case) |
| `AC-08-7` | `--start` / `--end` time range filtering; invalid dates produce a clear error | `job-tracking/JOB-03` |
| `AC-08-8` | Overflow footer when matches exceed limit | `job-tracking/JOB-02` |
| `AC-08-9` | Empty state prints `No jobs match.` | `job-tracking/JOB-01` |
| `AC-08-10` | `--json` prints full result object as pretty-printed JSON | `job-tracking/JOB-02` |
| `AC-08-11` | Invalid input throws with clear error (no silent empty) | `job-tracking/JOB-03` |
| `AC-08-12` | No `--all` flag; JD content not searchable via CLI | `job-tracking/JOB-03` |

## Known Gaps in Acceptance Coverage

These behaviors have been built (or have a documented AC) but are not yet
exercised by an acceptance case. They are the candidates for the next case
additions, in priority order.

| Requirement | Behavior | Why uncovered | Suggested case |
|---|---|---|---|
| `AC-04-3` | `wolf tailor full <jobId> --diff` prints before/after of every changed bullet | `--diff` output never asserted | Extend `tailor/TAILOR-02` or add `TAILOR-04-diff` |
| `AC-04-4` | Tailored resume single-page guard via fit-loop binary search; floor-overflow throws `CannotFitError` | Fit-loop assertion missing on long-resume fixture | Add `tailor/TAILOR-04-fit-loop-overflow` (needs an oversized resume fixture) |
| `AC-05-3` | No system-level dependencies required for HTML+Playwright pipeline | Implicitly covered by clean-machine smoke runs but not asserted as its own case | Optional: add `tailor/TAILOR-05-no-system-deps` (CI-only env without xelatex/md-to-pdf) |
| `AC-01-*` | `wolf init` happy path, workspace confirmation, key summary, etc. | Currently exercised by smoke `bootstrap`, not acceptance | Decide whether to promote smoke `bootstrap` cases into an acceptance `init` group |
| `AC-09-*` | `wolf env show` masks values; `wolf env clear` removes RC lines | No acceptance group exists; `wolf env clear` modifies user shell RC and is forbidden in automated tests | Add `env` group as `human-guided` for `clear`, automated for `show` |
| `UC-02.2.2` / `UC-06.1.2` / `UC-07.1.2` | MCP variants of add / tailor / cover-letter | Whole `mcp-contract` group is `planned` | Track under `mcp-contract` planned group |

## Planned Coverage

| Product Area | Group | Status |
|---|---|---|
| Job discovery providers and dedupe | `hunt` | planned |
| Job scoring and hard filters | `score` | planned |
| Application form analysis and fill dry-run | `fill` | planned |
| Outreach draft and send boundaries | `reach` | planned |
| MCP tool schema and response contracts | `mcp-contract` | planned |

When a feature moves from planned to implemented, update this matrix in the same
change as the acceptance case. When you add a new AC to
`docs/requirements/ACCEPTANCE_CRITERIA.md`, add a row here in the same PR — even
if the row goes straight into the "Known Gaps" table.
