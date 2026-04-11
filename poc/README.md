# POC — Proof of Concept experiments

Self-contained minimal scripts that validate specific technical approaches
before production code lands under `src/`.

## What belongs here

- Single-question feasibility experiments
- Throwaway / reference code — doesn't need to follow production conventions
- Frozen reference implementations after an experiment concludes

## What does NOT belong here

- Production code — goes under `src/`
- Unit / integration tests — colocated with the code they test
- One-off maintenance scripts — would go under `scripts/` if added later

## Layout

Each POC is its own subfolder with:
- `README.md` — the question it answers, run command, and results
- The minimal code / HTML / data to run the experiment
- An optional `output/` (gitignored) for generated artifacts
- An optional local `tsconfig.json` extending the root, so the POC gets
  type-checked without being compiled into the main `dist/`

## Current POCs

| Folder | Purpose | Status |
|---|---|---|
| [`filling/`](filling/) | Auto form-fill pipeline for `wolf fill` (Milestone 4) | Frozen reference imported from `dev/v0.4` |
| [`html-rendering/`](html-rendering/) | HTML + Playwright resume renderer for `wolf tailor` (Milestone 3) | Active — Phase 2 architecture spike |

---

### `filling/` — form-fill pipeline

**Question:** Can wolf drive a real Chrome browser to auto-fill job
application forms, using Claude once per page to map fields, without the
AI round-tripping on every click?

**Origin:** Cherry-picked from `dev/v0.4` commit `648b280` ("poc: add fill
pipeline POC using Playwriter + Claude"). That branch is sitting idle and
may not land for a while — this POC is captured under `poc/filling/` so
its findings don't disappear with the branch.

**Architecture validated — two-phase pipeline:**

```
1. Snapshot   — one Browser MCP / Playwriter call → DOM accessibility tree
2. Analyze    — one Claude API call → {field → profile value} mapping
                (AI reads; AI never executes clicks)
3. Execute    — wolf loops the mapping, calls type / click / setInputFiles
                directly via Playwright. No AI round-trips per field.
```

**Key findings:**

- **Real Chrome via Playwriter CDP relay works.** Avoids the
  `navigator.webdriver` flag that trips bot-detection on major ATS sites.
- Two transports validated side by side:
  - `fill-browsermcp.ts` — uses the Browser MCP Chrome extension (one-click
    install for end users, no local Chrome config)
  - `fill-playwriter.ts` — uses Playwriter CDP relay directly (no
    extension, but requires a Chrome launch flag)
- **File upload** (resume attach) is the only op that isn't type/click.
  Browser MCP doesn't yet expose upload, so production fallback is
  Playwright's `setInputFiles()`.
- **Submit is blocked by design.** The POC never actually clicks submit —
  production should add a confirmation step so the user always sees the
  form filled out before it goes.
- **One Claude call per page is enough.** The two-phase architecture means
  AI cost is bounded: multi-page forms re-run snapshot + analyze, not
  per-field.

**Known limitations (carried forward to Milestone 4):**

| Limitation | Plan for production |
|---|---|
| File upload not in Browser MCP | Fall back to Playwright `setInputFiles()` |
| Multi-page forms | Re-run snapshot + analyze per page |
| CAPTCHA | Pause and hand off to user |
| Hardcoded profile | Wire to `wolf.toml` / `src/repository/` |

**Running the POC** requires:
- Either the Browser MCP Chrome extension, or Chrome launched with the
  Playwriter CDP flag
- `playwright-core` + `playwriter` as npm deps — **not** in wolf's main
  `package.json`; install manually if you want to reproduce
- `WOLF_ANTHROPIC_API_KEY` in your environment

See [`filling/README.md`](filling/README.md) for step-by-step instructions
and [`filling/DESIGN_zh.md`](filling/DESIGN_zh.md) for the original design
document.

**What happens when Milestone 4 starts:** the `fillApplicationService` in
`src/application/impl/` will pick up these findings and build a
`browserService` around the two-phase pipeline. The POC code itself isn't
merged directly — it's a reference that documents the architecture and
the dead ends already ruled out.

---

### `html-rendering/` — HTML + Playwright resume renderer

**Question:** Can we replace LaTeX with HTML + CSS + Playwright as wolf's
resume renderer, using an iterative `fit()` function that shrinks or
expands parameters to exactly one page, and having Claude retry via
typed error signals when the content is unfittable?

**Status:** Active — this is the Phase 2 spike of the layered-refactor
plan. All the architecture detail (shell / Claude-body contract, fit()
algorithm, failure modes, the `CannotFitError` / `CannotFillError` retry
contract for Phase 3) lives in [`html-rendering/README.md`](html-rendering/README.md).

**Summary of findings so far:**

- HTML + Playwright `page.pdf()` produces print-quality output with no
  LaTeX install burden
- `fit()` shrink path (fontSize → lineHeight → marginIn floors + binary
  search refinement) converges in 7–17 iterations on realistic content
- Expand path (sectionGap → fontSize ceilings, with aesthetic limits
  `sectionGap ≤ 2em` and `fontSize ≤ 14pt`) handles sparse content
  without producing padded-looking output
- Both failure modes (too long / too short) throw typed errors that carry
  enough trace info for the application layer to generate natural-language
  Claude feedback — **no image analysis or vision model needed**
- `pdftoppm` produces per-page PNGs for developer eyeball during spike
  work; it's **not** used by production wolf (Phase 3
  `tailorApplicationService` only ships PDFs)

Verdict: acceptable so far. See
[`html-rendering/VERDICT.md`](html-rendering/VERDICT.md) once finalized.

---

## Adding a new POC

1. Create `poc/<short-name>/`
2. Add a `README.md` stating the question, run command, expected result
3. Add a local `tsconfig.json` if the POC uses TypeScript
4. Keep it minimal — POCs answer one question, not produce a product
