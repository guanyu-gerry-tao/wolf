# Wolf Profile Fixtures

## Purpose

Pre-built `profile.md` + `resume_pool.md` pairs that acceptance tests drop
into `WOLF_DEV_HOME/profiles/default/` to set up a candidate identity. Each
fixture is one persona — a realistic candidate the AI agents can build a
tailored resume / cover letter from.

These fixtures are for **acceptance test infrastructure only**. They are
NOT used by `wolf init` or shown to end users.

## Why fixtures

Inlining 50+ lines of profile + resume content via heredocs in every TAILOR-XX
case duplicates text and drifts as templates evolve. Centralising fixtures
here lets AC docs stay short (`cp -r test/fixtures/wolf-profile/swe-mid/* "$WS/profiles/default/"`)
and lets us add coverage by adding a new fixture rather than another inlined
heredoc.

## Layout

```
test/fixtures/wolf-profile/
├── README.md                      ← this file
├── README_zh.md
├── swe-mid/                       ← mid-career SWE persona (Java/Scala/Spark/Kafka)
│   ├── profile.md
│   └── resume_pool.md
└── ng-swe/                        ← new-grad SWE persona (TS/Go/Python; F-1 OPT)
    ├── profile.md
    └── resume_pool.md
```

Each fixture's `profile.md` satisfies `assertReadyForTailor`'s required
fields (Legal first name, Legal last name, Email, Phone) and represents
one consistent candidate identity. `resume_pool.md` has well above the
5-substantive-line floor.

## Use in tests

Acceptance test setup blocks copy the fixture into the workspace's default
profile dir:

```bash
WS=/tmp/wolf-test/acceptance/<run-id>/workspaces/<test-id>
WOLF_DEV_HOME="$WS" npm run wolf -- init --dev --empty
cp -r test/fixtures/wolf-profile/swe-mid/* "$WS/profiles/default/"
```

(`cp -r` here is from the repo root, since the test runner cwd is the wolf repo.)

After the copy, `wolf tailor full --job <id>` will see a fully-populated
profile + resume pool and produce realistic output.

## Picking a fixture

| Fixture | Use it when |
|---|---|
| `swe-mid` | Tailor / cover-letter tests where a multi-role experienced backend candidate is the right shape (Spark / Kafka / Java) |
| `ng-swe` | NG mass-apply scenarios; F-1 + H-1B sponsorship preference is set; intern-level roles, lighter pool |

Add a new persona by creating a sibling dir with `profile.md` + `resume_pool.md`
and updating this table.

## Constraints

- Fixtures contain **fictional people**. Never use real names, emails,
  phone numbers, schools, or companies that resolve to real identities.
- Email addresses use the `.test` TLD (per RFC 6761) so they cannot send.
- Phone numbers use 555-prefix exchanges that are reserved for fiction.
- Fixtures must keep the wolf marker convention: `> [!IMPORTANT]` / `> [!TIP]`
  blockquotes for any AI-invisible authoring annotations. Stripping these
  must leave a coherent, full profile / pool behind.

## Updating

When templates change shape (new H1, deleted H2, etc.), update fixtures so
acceptance tests still drop in valid content. Keep this README's layout
table and persona table in sync.
