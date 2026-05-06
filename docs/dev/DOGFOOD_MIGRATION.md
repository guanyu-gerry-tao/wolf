# Dogfood migration: dev → stable

How to carry data from a dev workspace (`~/wolf-dev`, populated via the
`wolf-dev` binary you built locally) into a fresh stable workspace
(`~/wolf`, populated via `npm i -g @gerryt/wolf`).

This is for the period **before** the first stable npm release, while
the only way to use wolf is the dev build, but you want to validate
end-to-end on the stable binary before publishing.

## Why this is needed

Dev and stable use **separate workspaces by design** so refactors on dev
can't corrupt your real data:

| Surface | dev | stable |
|---|---|---|
| Workspace dir | `~/wolf-dev` (`WOLF_DEV_HOME`) | `~/wolf` (`WOLF_HOME`) |
| Bin | `wolf-dev` | `wolf` |
| Env var prefix | `WOLF_DEV_*` (falls back to `WOLF_*`) | `WOLF_*` |
| MCP tool prefix | `wolfdev_*` | `wolf_*` |
| Workspace `CLAUDE.md` / `AGENTS.md` | written with `wolf-dev` commands | written with `wolf` commands |

Same SQLite schema, same profile-file shape, same per-job artifact layout
— only the surrounding identity differs. So a migration is mostly file
copy plus a couple of identity-string fixups.

## What's actually in a workspace

```
~/wolf-dev/
├── wolf.toml                     ← config (model picks, default profile name)
├── CLAUDE.md / AGENTS.md         ← AI agent instructions (binary-specific)
├── profiles/<name>/
│   ├── profile.toml              ← identity, resume pool, work auth, Q&A
│   ├── score.md                  ← optional profile-level scoring guidance
│   ├── prompts/                  ← editable strategy prompt pack
│   └── attachments/              ← transcripts, references, etc.
└── data/
    ├── wolf.sqlite               ← jobs DB
    ├── logs/wolf.log.jsonl       ← log file (don't migrate; let stable start fresh)
    └── jobs/<jobId>/             ← per-job artifacts (resume.pdf, cover_letter.pdf, brief.md, ...)
```

| Bucket | Migrate? |
|---|---|
| Profile files (`profile.toml`, `score.md`, `prompts/`, `attachments/`) | **Yes** — your real content |
| Jobs DB (`data/wolf.sqlite`) | **Yes if you added jobs during dogfood** |
| Job artifacts (`data/jobs/<jobId>/`) | **Yes if you tailored during dogfood** |
| `wolf.toml` | **Skip** — let stable regenerate; it'll have stable defaults instead of `instance.mode = "dev"` |
| `CLAUDE.md` / `AGENTS.md` | **Skip** — let stable regenerate; the binary references inside differ |
| `data/logs/wolf.log.jsonl` | **Skip** — runtime state, fresh start is cleaner |

## Path A — Cherry-pick (recommended)

Lets stable's `wolf init` produce a clean `wolf.toml` + `CLAUDE.md` /
`AGENTS.md` for the stable binary, then drops your dev content on top.

```bash
# 0. Prerequisites:
#    - @gerryt/wolf installed:           npm i -g @gerryt/wolf
#    - WOLF_ANTHROPIC_API_KEY set:       wolf env set
#    - ~/wolf does not yet exist (otherwise back it up first)

# 1. Stable workspace skeleton — use the stable init flow so wolf.toml and
#    CLAUDE.md/AGENTS.md contain stable `wolf <verb>` references.
wolf init

# 2. Copy profile content
cp ~/wolf-dev/profiles/default/profile.toml ~/wolf/profiles/default/
cp ~/wolf-dev/profiles/default/score.md     ~/wolf/profiles/default/ 2>/dev/null
cp -r ~/wolf-dev/profiles/default/prompts/. \
      ~/wolf/profiles/default/prompts/ 2>/dev/null

# 3. Copy attachments if you have any
cp -r ~/wolf-dev/profiles/default/attachments/. \
      ~/wolf/profiles/default/attachments/ 2>/dev/null

# 4. Copy the jobs DB (skip if you didn't add any jobs in dev)
cp ~/wolf-dev/data/wolf.sqlite ~/wolf/data/ 2>/dev/null

# 5. Copy per-job artifacts (skip if you didn't tailor in dev)
cp -r ~/wolf-dev/data/jobs/. ~/wolf/data/jobs/ 2>/dev/null

# 6. Verify
wolf doctor                  # all profile + key + Chromium checks should pass
wolf job list                # should show the jobs you added in dev
```

**Why not just `cp -r ~/wolf-dev/ ~/wolf/`?** That would carry the dev
build's `wolf.toml` (with `instance.mode = "dev"` if you used
`wolf-dev init --preset empty`) and the dev-flavoured `CLAUDE.md` /
`AGENTS.md` (where AI agents would see `wolf-dev <verb>` and tell you to
run a binary that doesn't exist on stable). Cherry-pick avoids both.

## Path B — Bulk copy with cleanup (faster, slightly riskier)

Use this if you have a lot of attachments or many jobs and want a
single-shot copy.

```bash
# 0. Prerequisites: same as Path A.
mkdir -p ~/wolf

# 1. Bulk copy
cp -r ~/wolf-dev/. ~/wolf/

# 2. Strip dev-only marker from wolf.toml if present
sed -i.bak '/^mode = "dev"/d' ~/wolf/wolf.toml
rm ~/wolf/wolf.toml.bak

# 3. Regenerate the AI-agent docs from the stable template
rm ~/wolf/CLAUDE.md ~/wolf/AGENTS.md
wolf init                      # writeIfAbsent fills the two files; existing ones stay

# 4. Drop the dev log (let stable start fresh)
rm -f ~/wolf/data/logs/wolf.log.jsonl

# 5. Verify
wolf doctor
wolf job list
```

## Verification checklist

After either path:

- [ ] `wolf doctor` reports READY (or only the same gaps you had on dev)
- [ ] `wolf job list` shows the jobs you added in dev
- [ ] Open `~/wolf/CLAUDE.md` — every code-block command says `wolf` (not `wolf-dev`)
- [ ] `head -1 ~/wolf/wolf.toml` does NOT contain `mode = "dev"`
- [ ] A real `wolf tailor full -j <jobId>` against an existing job produces a fresh `resume.pdf` (proves the SQLite copy and Chromium auto-install both work)

## What about the env vars?

You may have `WOLF_DEV_ANTHROPIC_API_KEY` set in your shell RC from when
you were testing dev. Stable reads `WOLF_ANTHROPIC_API_KEY` only — no
fallback in the other direction. Two options:

- **Recommended**: run `wolf env set` once after installing stable.
  Writes `WOLF_ANTHROPIC_API_KEY` (same value as your dev key, if you
  reuse it) to your shell RC. Restart the terminal.
- **Manual**: edit `~/.zshrc` (or equivalent), copy the
  `WOLF_DEV_ANTHROPIC_API_KEY=...` line into a `WOLF_ANTHROPIC_API_KEY=...`
  line right next to it. Both can coexist; dev keeps reading
  `WOLF_DEV_*`, stable reads `WOLF_*`.

## What about the dev workspace afterwards?

`~/wolf-dev` is untouched by the migration. Keep it as your sandbox for
ongoing wolf development. Both binaries (`wolf` and `wolf-dev`) coexist
on PATH and operate on independent workspaces.

If you want to start fresh on dev too:
```bash
rm -rf ~/wolf-dev
wolf-dev init --preset empty
```

## When does this guide stop being needed?

Once `@gerryt/wolf` is on npm, friends and you start dogfooding stable
directly. This dev → stable migration is only the bootstrap path for
**you specifically** — first time you publish, you want to validate
stable on real data without re-typing your profile from scratch.

Once stable workspace migrations land (per the `## Workspace migrations`
section in the root `CLAUDE.md`), this guide will be superseded by a
schema-aware migration framework that runs automatically.
