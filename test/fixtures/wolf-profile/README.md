# Wolf Profile Fixtures

## Purpose

Pre-built persona fixtures that acceptance tests load into
`WOLF_DEV_HOME/profiles/default/profile.toml` through the public
`wolf profile` CLI. Each fixture is one persona — a realistic candidate the AI
agents can build a tailored resume / cover letter from.

These fixtures are for **acceptance test infrastructure only**. They are
NOT used by `wolf init` or shown to end users.

## Why fixtures

Inlining 50+ lines of profile + resume content via heredocs in every TAILOR-XX
case duplicates text and drifts as templates evolve. Centralising fixtures
here lets AC docs stay short and keeps setup aligned with the current
`profile.toml` governance surface instead of copying legacy markdown files.

## Layout

```
test/fixtures/wolf-profile/
├── README.md                      ← this file
├── README_zh.md
├── scripts/
│   └── populate_v2_profile.sh      ← CLI-backed profile.toml fixture loader
├── swe-mid/                       ← mid-career SWE persona (Java/Scala/Spark/Kafka)
│   ├── profile.md
│   └── resume_pool.md
└── ng-swe/                        ← new-grad SWE persona (TS/Go/Python; F-1 OPT)
    ├── profile.md
    └── resume_pool.md
```

The markdown files are human-readable source/reference material for the
personas. Runnable acceptance setup uses `scripts/populate_v2_profile.sh`,
which writes the same persona shape into `profile.toml` via `wolf profile set`
and `wolf profile add`.

## Use in tests

Acceptance test setup blocks initialize a workspace, then populate the default
profile through the CLI:

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/<test-id>
WOLF_DEV_HOME="$WS" npm run wolf -- init --preset empty
bash test/fixtures/wolf-profile/scripts/populate_v2_profile.sh ng-swe "$WS"
```

The script is run from the repo root, since the test runner cwd is the wolf
repo. It does not call AI. API-backed cases should still run `wolf doctor`
after setup so missing API credentials or Playwright Chromium fail before the
expensive command.

After the script, `wolf tailor full --job <id>` will see a fully-populated
profile, resume pool, and builtin question answers and produce realistic output.

## Picking a fixture

| Fixture | Use it when | Currently exercised by |
|---|---|---|
| `ng-swe` | Wolf's primary user persona — NG mass-apply scenarios; F-1 + H-1B sponsorship preference is set; intern-level roles, lighter pool. Default fixture for new AC cases. | `TAILOR-01` (full pipeline) |
| `swe-mid` | Mid-career multi-role experienced backend candidate (Spark / Kafka / Java). Useful when the case under test specifically needs a senior-shaped pool. | Reference persona for `TAILOR-04` |
| `swe-mid-no-education` | Same mid-career backend persona, but no education entries and `resume.section_order` set to Experience → Project → Skills. | `TAILOR-04a` |
| `swe-mid-reordered` | Same mid-career backend persona with `resume.section_order` set to Skills → Project → Experience → Education. | `TAILOR-04b` |

> Fixture coverage is intentionally narrow right now: one canonical fixture-driven AC case per persona. The same principle applies elsewhere — additional persona × scenario combinations stay deferred until the prompt-debugging phase, when a known-good prompt lets us measure persona-specific quality regressions instead of soaking time on AC-inline persona variation.

Add a new runnable persona by extending `scripts/populate_v2_profile.sh` and
updating this table. A sibling markdown directory may still be added when a
human-readable source fixture is useful.

## Constraints

- Fixtures contain **fictional people**. Never use real names, emails,
  phone numbers, schools, or companies that resolve to real identities.
- Email addresses use the `.test` TLD (per RFC 6761) so they cannot send.
- Phone numbers use 555-prefix exchanges that are reserved for fiction.
- Markdown reference fixtures must keep the wolf marker convention:
  `> [!IMPORTANT]` / `> [!TIP]` blockquotes for any AI-invisible authoring
  annotations. Stripping these must leave a coherent, full profile / pool
  behind.

## Updating

When templates change shape (new required fields, renamed arrays, deleted
sections, etc.), update `populate_v2_profile.sh` so acceptance tests still
produce valid `profile.toml` content. Keep this README's layout table and
persona table in sync.
