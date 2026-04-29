# Changelog

All notable changes to wolf are recorded here. wolf follows
[semantic versioning](https://semver.org/) (with the `0.x` caveat: minor
version bumps may include breaking changes until `1.0`).

## v0.1.0 — 2026-04-28

First stable release on npm: `npm i -g @gerryt/wolf`. Tailor pipeline
(analyst + resume + cover letter writer, 3-agent checkpoint flow) is
the only feature shipped end-to-end. `hunt` / `score` / `fill` / `reach`
are registered but print a clean "not yet available" message and exit.

### Added
- Stable npm package `@gerryt/wolf` published from `package.stable.json`
  via `scripts/publish-stable.sh` (root `package.json` is the dev workspace
  manifest, never published).
- Dev binary `wolf-dev` (separate from stable `wolf`) so dogfooding the
  stable release and iterating on dev can coexist on the same machine.
- `update-notifier` integration — stable users see a one-line banner when
  a newer `@gerryt/wolf` ships (24h cache; never blocks the user's
  command).
- Typed errors: `MissingApiKeyError` (`MISSING_API_KEY`) and
  `MissingChromiumError` (`MISSING_CHROMIUM`). CLI renders these as a
  single stderr line + exit 1 (no stack trace). MCP tool handlers serialize
  them as `{ isError: true, content: [{ text: JSON of { errorCode, ... } }] }`
  so AI orchestrators can branch on `errorCode`.
- `assertApiKey()` guard — tailor (analyze / writeResume / writeCoverLetter
  / full) calls it before any Claude API request, surfacing missing-key
  errors before a confusing 401 bubbles up.
- Chromium auto-install — render service detects a missing
  Playwright Chromium binary on first launch and runs
  `npx playwright install chromium` automatically (with progress streamed
  to the user's terminal). No prompt, no postinstall hook.
- `wolf doctor` reports `WOLF_ANTHROPIC_API_KEY` presence and Playwright
  Chromium presence alongside the existing profile checks.
- `[NOT YET IMPLEMENTED — Mn]` markers on `hunt` / `score` / `fill` /
  `reach` in `wolf --help` so users see the roadmap without surprise.
- `## Workspace migrations` and `## Releasing (stable npm)` sections in
  root `CLAUDE.md` and `AGENTS.md`.

### Changed
- `better-sqlite3`: `^11.9.1` → `^12.9.0` (broader Node 20–25 prebuild
  coverage).
- `playwright`: `devDependencies` → `dependencies` (the render service
  imports `chromium` at runtime).
- README rewrite: 7-step "5-minute" Quick start with explicit profile-fill
  step; dev-build instructions reflect the new `wolf-dev` binary.

### Engines
- Node `>=20.0.0` (drops Node 18 EOL).
