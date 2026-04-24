# Wolf Acceptance Tests

This document is the load-bearing acceptance suite for wolf. It is readable by
humans and executable by an AI orchestrator. There is no custom runner yet: copy
the orchestrator prompt below into an agent runner and let it dispatch one group
agent per group.

## Safety Rules

Automated acceptance agents must only create test workspaces under
`/tmp/wolf-at-*`. Every wolf invocation in automated tests must pass an explicit
`WOLF_DEV_HOME=/tmp/wolf-at-<ID>`.

Automated agents must never create, modify, or delete:

- `~/wolf/`
- `~/wolf-dev/`
- repo-local `data/`
- shell RC files such as `~/.zshrc`
- any non-test path outside `/tmp/wolf-at-*`

The only allowed repo mutation during an acceptance run is normal
`npm run build:dev` output under `dist/`.

Required invocation shape:

```bash
cd /Users/guanyutao/developers/personal-projects/wolf
npm run build:dev
WOLF_DEV_HOME=/tmp/wolf-at-T02 npm run wolf -- init --dev --empty
WOLF_DEV_HOME=/tmp/wolf-at-T02 npm run wolf -- status
rm -rf /tmp/wolf-at-T02
```

## How To Run

Copy this prompt to Claude Code or another agent runner:

```text
You are the Wolf Acceptance Test Orchestrator.

1. Read docs/dev/ACCEPTANCE_TESTS.md.
2. Identify all groups except GROUP-H. Skip tests with Cost: high unless the
   user explicitly says --allow-costly.
3. Dispatch one sub-agent per group in parallel. Each group agent must:
   a. cd /Users/guanyutao/developers/personal-projects/wolf
   b. run npm run build:dev once for the group
   c. run the group's tests in order
   d. use WOLF_DEV_HOME=/tmp/wolf-at-<ID> for every wolf invocation
   e. create and clean up only its own /tmp/wolf-at-* workspace
   f. record pass/fail/skipped with captured stdout, stderr, and exit code
4. Never touch ~/wolf, ~/wolf-dev, repo data/, or shell RC files.
5. After all groups finish, print per-group and overall pass/fail/skipped
   counts. Include failure evidence inline.
```

## Groups

| Group | Tests | Kind | Default Model | Notes |
|---|---|---|---|---|
| GROUP-A init | T-01 | reset | haiku | Scriptable init and dev marker |
| GROUP-B read commands | T-02, T-03 | reset | haiku | status and job list on empty workspace |
| GROUP-C config | T-04, T-05 | reset | haiku | config get/set roundtrip |
| GROUP-D profile | T-06 | reset | haiku | profile list default state |
| GROUP-E env | T-07 | reset | haiku | env show only |
| GROUP-F workflows | W-A, W-B | chain | sonnet | add/status/list flows |
| GROUP-H human-only | H-01, H-02, H-03, H-04 | human | - | Skipped by orchestrator |

## Reset Tests

### T-01 - `wolf init --dev --empty` creates a valid dev workspace

**Group:** GROUP-A init  
**Kind:** reset  
**Cost:** free  
**Requires:** nothing

**Prompt to group agent:**

Create `/tmp/wolf-at-T01`. Run:

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T01 npm run wolf -- init --dev --empty
```

Verify `wolf.toml`, `profiles/default/profile.toml`,
`profiles/default/resume_pool.md`, and `data/` exist under
`/tmp/wolf-at-T01`. Verify `wolf.toml` contains `[instance] mode = "dev"`.
Verify no files were created under `~/wolf`, `~/wolf-dev`, or repo `data/`.
Clean up only `/tmp/wolf-at-T01`.

**Pass criteria:**

- Exit code 0.
- Dev banner appears on stderr.
- All workspace files are under `/tmp/wolf-at-T01`.
- `wolf.toml` has `instance.mode = "dev"`.

### T-02 - `wolf status` on an empty workspace

**Group:** GROUP-B read commands  
**Kind:** reset  
**Cost:** free  
**Requires:** T-01 pattern

**Prompt to group agent:**

Create `/tmp/wolf-at-T02`, initialize it with `init --dev --empty`, then run:

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T02 npm run wolf -- status
```

Ignore the dev banner line when checking command output. Clean up only
`/tmp/wolf-at-T02`.

**Pass criteria:**

- Exit code 0.
- stdout contains `tracked`, `tailored`, and `applied`.
- Each counter is `0`.
- Dev banner appears on stderr.

### T-03 - `wolf job list --search "%"` on an empty workspace

**Group:** GROUP-B read commands  
**Kind:** reset  
**Cost:** free  
**Requires:** T-01 pattern

**Prompt to group agent:**

Create `/tmp/wolf-at-T03`, initialize it with `init --dev --empty`, then run:

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T03 npm run wolf -- job list --search "%"
```

Clean up only `/tmp/wolf-at-T03`.

**Pass criteria:**

- Exit code 0.
- stdout contains `No jobs match.`
- Dev banner appears on stderr.

### T-04 - `wolf config get tailor.model` returns the default

**Group:** GROUP-C config  
**Kind:** reset  
**Cost:** free  
**Requires:** T-01 pattern

**Prompt to group agent:**

Create `/tmp/wolf-at-T04`, initialize it with `init --dev --empty`, then run:

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T04 npm run wolf -- config get tailor.model
```

Clean up only `/tmp/wolf-at-T04`.

**Pass criteria:**

- Exit code 0.
- stdout contains `anthropic/claude-sonnet-4-6`.
- Dev banner appears on stderr.

### T-05 - `wolf config set` roundtrips through `wolf.toml`

**Group:** GROUP-C config  
**Kind:** reset  
**Cost:** free  
**Requires:** T-01 pattern

**Prompt to group agent:**

Create `/tmp/wolf-at-T05`, initialize it with `init --dev --empty`, then run:

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T05 npm run wolf -- config set tailor.model anthropic/claude-haiku-4-5
WOLF_DEV_HOME=/tmp/wolf-at-T05 npm run wolf -- config get tailor.model
```

Clean up only `/tmp/wolf-at-T05`.

**Pass criteria:**

- Both commands exit 0.
- Final stdout contains `anthropic/claude-haiku-4-5`.
- `wolf.toml.backup1` exists under `/tmp/wolf-at-T05`.
- Dev banner appears on stderr.

### T-06 - `wolf profile list` shows the default profile

**Group:** GROUP-D profile  
**Kind:** reset  
**Cost:** free  
**Requires:** T-01 pattern

**Prompt to group agent:**

Create `/tmp/wolf-at-T06`, initialize it with `init --dev --empty`, then run:

```bash
WOLF_DEV_HOME=/tmp/wolf-at-T06 npm run wolf -- profile list
```

Clean up only `/tmp/wolf-at-T06`.

**Pass criteria:**

- Exit code 0.
- stdout contains a `default` profile line marked with `*`.
- Dev banner appears on stderr.

### T-07 - `wolf env show` with no keys set

**Group:** GROUP-E env  
**Kind:** reset  
**Cost:** free  
**Requires:** nothing

**Prompt to group agent:**

Run `wolf env show` through the dev binary while clearing WOLF key values only
for that subprocess:

```bash
env -u WOLF_ANTHROPIC_API_KEY -u WOLF_APIFY_API_TOKEN -u WOLF_GMAIL_CLIENT_ID -u WOLF_GMAIL_CLIENT_SECRET npm run wolf -- env show
```

Do not run `wolf env clear`.

**Pass criteria:**

- Exit code 0.
- stdout marks each key as not set.
- stdout does not contain any secret values.
- Dev banner appears on stderr.

## Chain Workflows

### W-A - add -> status -> list happy path

**Group:** GROUP-F workflows  
**Kind:** chain  
**Cost:** free  
**Requires:** shared `/tmp/wolf-at-WA`

**Prompt to group agent:**

Create `/tmp/wolf-at-WA`, initialize it with `init --dev --empty`, then run:

```bash
WOLF_DEV_HOME=/tmp/wolf-at-WA npm run wolf -- add --title "Backend Engineer" --company "Acme" --jd-text "Build APIs in TypeScript."
WOLF_DEV_HOME=/tmp/wolf-at-WA npm run wolf -- status
WOLF_DEV_HOME=/tmp/wolf-at-WA npm run wolf -- job list --search Acme
```

Clean up only `/tmp/wolf-at-WA`.

**Pass criteria:**

- All commands exit 0.
- `add` returns JSON with `jobId`.
- `status` shows `tracked  1`.
- `job list` shows `Acme` and `Backend Engineer`.
- Dev banner appears on stderr for each command.

### W-B - multiple jobs search behavior

**Group:** GROUP-F workflows  
**Kind:** chain  
**Cost:** free  
**Requires:** shared `/tmp/wolf-at-WB`

**Prompt to group agent:**

Create `/tmp/wolf-at-WB`, initialize it with `init --dev --empty`, add two
jobs for `Acme`, then compare a matching and non-matching search:

```bash
WOLF_DEV_HOME=/tmp/wolf-at-WB npm run wolf -- add --title "Frontend Engineer" --company "Acme" --jd-text "React UI work."
WOLF_DEV_HOME=/tmp/wolf-at-WB npm run wolf -- add --title "Platform Engineer" --company "Acme" --jd-text "Internal platform work."
WOLF_DEV_HOME=/tmp/wolf-at-WB npm run wolf -- job list --search Acme
WOLF_DEV_HOME=/tmp/wolf-at-WB npm run wolf -- job list --search Other
```

Clean up only `/tmp/wolf-at-WB`.

**Pass criteria:**

- All commands exit 0.
- The `Acme` search shows both jobs.
- The `Other` search prints `No jobs match.`
- Dev banner appears on stderr for each command.

## Human-Only Tests

### H-01 - `wolf init` interactive UX

**Kind:** human  
**Cost:** free  
**Reason skipped:** Requires prompt judgment.

Run the stable binary manually and verify the setup wizard wording, prompt
order, validation, and final next-step guidance.

### H-02 - `wolf tailor` output quality on a real JD

**Kind:** human  
**Cost:** high  
**Reason skipped:** Calls Anthropic and requires human quality review.

### H-03 - `wolf fill` against a real application form

**Kind:** human  
**Cost:** medium  
**Reason skipped:** Uses browser automation and may touch real websites.

### H-04 - `wolf env clear`

**Kind:** human  
**Cost:** free  
**Reason skipped:** Mutates shell RC files such as `~/.zshrc`.

## Enforcement Rule

Any PR that adds or changes CLI behavior must update this document in the same
PR. Use `kind: reset` for deterministic free behavior, `kind: chain` for
multi-step workflows, and `kind: human` for interactive, costly, browser, email,
or global-shell-state behavior.
