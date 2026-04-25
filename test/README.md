# Wolf Test Suites

Wolf uses two test suites:

- `smoke/` is the fast gate. It proves the dev build, workspace isolation, and
  core CLI paths still work. Passing smoke tests does not prove full feature
  coverage.
- `acceptance/` is the coverage gate. It maps implemented behavior back to
  `docs/requirements/USE_CASES.md` and
  `docs/requirements/ACCEPTANCE_CRITERIA.md`.

## Directory Layout

```text
test/
├── README.md
├── README_zh.md
├── smoke/
│   ├── README.md
│   ├── README_zh.md
│   └── groups/
│       └── <group-id>/
│           ├── README.md
│           └── README_zh.md
└── acceptance/
    ├── README.md
    ├── README_zh.md
    └── groups/
        └── <group-id>/
            ├── README.md
            └── README_zh.md
```

Each group tests one product area. Do not mix unrelated areas in one group:
`hunt` tests do not belong with `fill`, `tailor` tests do not belong with
`reach`, and MCP contract tests stay separate from CLI workflow tests unless the
group is explicitly an end-to-end workflow group.

## Safety Rules

Automated tests write runtime workspaces under `/tmp/wolf-test/` and durable
reports under repo-local `test/runs/`.

Every wolf invocation in automated tests must pass an explicit
`WOLF_DEV_HOME=/tmp/wolf-test/<suite>/<run-id>/workspaces/<workspace-id>`.

Automated agents must never create, modify, or delete:

- `~/wolf/`
- `~/wolf-dev/`
- repo-local `data/`
- shell RC files such as `~/.zshrc`
- any path outside `/tmp/wolf-test/`

Reports, logs, and lightweight artifact indexes may be written under
`test/runs/<run-id>/`. The `test/runs/` directory is kept in git with
`.gitkeep`, but every run result inside it is gitignored because reports are
local run output, not shared test definitions.

The only allowed repo mutation during an automated run is normal
`npm run build:dev` output under `dist/`.

## Execution Modes

- `automated`: an agent can run the commands and judge the result directly.
- `ai-reviewed`: an agent runs the commands, then an AI reviewer inspects the
  generated artifacts with a rubric.
- `human-guided`: a human performs constrained steps from written instructions.
- `human-approval`: automation stops before an external side effect and asks
  for approval.
- `skipped-by-default`: costly, risky, or account-dependent tests are skipped
  unless the user explicitly allows them.

Prefer deterministic assertions first, AI artifact review second, and human
work only when an external side effect or final subjective judgment requires it.

## Runner Interaction Policy

Run test suites in the agent runner's normal execution mode. Use the least
interactive path available:

- Do not ask the human to approve every individual command.
- Batch related safe commands when the runner allows it.
- Request human approval only when the runner requires it for a permission
  boundary or before an external side effect.
- If the runner requires a short plan or checklist before execution, that is
  allowed, but the runner must continue into execution in the same task.
- Do not stop after returning a plan. A test run must end with reports.
- If approval is denied or unavailable, write a `BLOCKED` report that names the
  command, explains why approval was needed, and lists what did not run.

## Required Reports

Every group must write a durable report under:

```text
test/runs/<suite>-<timestamp>/reports/<group-id>/report.md
```

The orchestrator must also write:

```text
test/runs/<suite>-<timestamp>/report.md
test/runs/LATEST.md
```

`report.md` is the suite summary. `LATEST.md` points coding agents to the most
recent run and its important failure reports.

The group report must include:

- test title
- purpose
- environment: cwd, commit, suite, group, run id, timestamps, build command
- command process: command, cwd, important env values, exit code
- stdout and stderr records, either inline for short output or saved under the
  group report directory
- result for each case: `PASS`, `FAIL`, `SKIPPED`, or `BLOCKED`
- evidence for each pass criterion
- bugs, with reproduction steps, expected behavior, actual behavior, severity,
  and related workspace paths
- improvements, with why they matter and a suggested change

Agent chat is not the source of truth. If the agent closes, the report file must
still explain what happened.

## Result Labels

- `PASS`: every pass criterion has concrete evidence.
- `FAIL`: a command failed, output differed from expectations, an artifact
  failed review, or a safety rule was violated.
- `SKIPPED`: the case was intentionally not run because of cost, risk, missing
  credentials, or human-only requirements.
- `BLOCKED`: a prerequisite failed, so the case could not be judged.

## Human Guidance

Human-guided tests must include:

- why a human is needed
- tester setup
- exact steps
- expected result
- edge conditions
- pass/fail rubric
- evidence to capture
- stop conditions
- cleanup

Human tests should be rare. For resume, cover-letter, and other quality checks,
prefer `ai-reviewed`: generate the artifact, have an AI reviewer inspect it
against a rubric, write the review into `report.md`, and leave human review as
an optional follow-up.
