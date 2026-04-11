# POC — HTML + Playwright resume rendering (architecture spike)

## Question

Can we build a `fit()` function that takes **AI-generated HTML body content**
and produces a **one-page PDF with no widows**, by iteratively adjusting CSS
variables that live in a stable shell template?

If yes → Phase 3 implements `htmlRenderService` on this pattern.
If no → fall back to LaTeX for resume rendering.

## Architecture being validated

```
resume.md + snippets
      ↓
   Claude  ──────►  generates <body> content + aesthetic CSS
                    (colors, layout, borders, letter-spacing, flex, etc.)
                    ──► MUST NOT set font-size / line-height / page margin
      ↓
   shell.html (hand-written, stable)
      ├── owns: --font-size, --line-height, --margin-in CSS variables
      ├── owns: @page margin rule
      ├── owns: widows / orphans / hyphens baseline typography CSS
      └── loads: Google Fonts (Inter)
      ↓
   fit() function  ──►  pure TS, injects `:root { --font-size: ...; ... }`
                         style overrides, uses Playwright to render + measure
                         scrollHeight, loops
      ├─ success → returns PDF bytes + final params + iteration trace
      └─ failure → throws CannotFitError (Phase 3 application layer
                    catches this and re-prompts Claude to shorten)
```

## Shell / Claude contract

**Shell owns** (in `shell.html`):
- `--font-size`, `--line-height`, `--margin-in` CSS variables
- `@page { size: letter; margin: var(--margin-in); }`
- `html, body { font-size: var(--font-size); line-height: var(--line-height); }`
- `widows / orphans / hyphens / break-inside / text-wrap: balance`
- Google Fonts link for Inter

**Claude body owns** (whatever it outputs):
- Semantic HTML structure
- Aesthetic CSS in its own `<style>` block: colors, borders, flex, grid,
  text-transform, letter-spacing, relative margins in `em`, etc.

**Claude body MUST NOT set**: `font-size`, `line-height`, `@page`, or absolute
margins in `in` / `cm` / `px`. (These are enforced by prompt in production;
in this POC, the fixtures demonstrate the rules.)

## Files

```
poc/html-rendering/
├── README.md          # this file
├── shell.html         # the hand-written shell (CSS vars + typography baseline)
├── fixtures/
│   ├── body-short.html  # simulated Claude output, ~15 lines, fits at defaults
│   ├── body-long.html   # ~60 lines, forces fit() to iterate
│   └── body-huge.html   # ~100 lines, intentionally un-fittable
├── fit.ts             # the function under validation
├── render.ts          # driver that runs fit() on each fixture
├── tsconfig.json      # local tsconfig (extends root, noEmit)
├── VERDICT.md         # human verdict after visual review
├── .gitignore         # ignores output/
└── output/            # generated PDFs (gitignored, recreated on each run)
```

## Run

```bash
# one-off: install Chromium if not already
npx playwright install chromium

# run the spike — outputs 3 PDFs (2 successful + 1 CannotFitError last-attempt)
npx tsx poc/html-rendering/render.ts
```

Expected console output shape:

```
[short] ✓ fit in 1 iter(s)
  final params: {"fontSize":11,"lineHeight":1.3,"marginIn":0.5}
  pdf pages: 1
  wrote: .../output/resume-short.pdf
  iter 1: fs=11pt lh=1.3 m=0.5in → scrollHeight=NNNpx (target ≤ NNNpx)

[long] ✓ fit in 3 iter(s)
  final params: {...}
  ...

[huge] ✗ CannotFitError after N iter(s)
  last params: {"fontSize":9.5,"lineHeight":1.1,"marginIn":0.3}
  last pdf pages: 2
  wrote (for inspection): .../output/resume-huge-failed.pdf
```

## Success criteria

Spike passes iff:

- `body-short` fits in 1 iteration, `pdf-lib` reports 1 page
- `body-long` fits in 2–6 iterations, `pdf-lib` reports 1 page, typography
  still legible at the final params
- `body-huge` throws `CannotFitError` (we EXPLICITLY want the floor to refuse
  to silently produce a 2-page PDF)
- Claude's aesthetic CSS (colors, borders, flex, etc.) survives intact in
  all the successful outputs — the fit function's overrides only touch the
  3 declared variables
- Visual inspection shows no widows in any successful output

Any failure downgrades the verdict — see `VERDICT.md`.

## Research foundations

Three parallel Explore agents surveyed the ecosystem before this spike was
written. Key takeaways:

1. **No existing library is worth adopting.** `resume-cli` is abandoned,
   `Resumed` is niche and Puppeteer-based, `Reactive Resume` is a full SaaS
   app using Gotenberg (Docker). Building on Playwright's native `page.pdf()`
   is cleaner (~200–400 LOC final). [Reactive Resume](https://github.com/amruthpillai/reactive-resume),
   [Resumed](https://github.com/rbardini/resumed)
2. **Fit-loop primitive**: `page.evaluate(() => document.body.scrollHeight)`
   is the measurement. Reference implementation:
   [vladartym/always-fit-resume](https://github.com/vladartym/always-fit-resume).
   Target 0.95 pages for Chromium DPI safety.
3. **Widow / orphan control**: pure CSS (`widows: 2; orphans: 2; hyphens: auto`)
   works in Chromium PDF rendering. No npm library needed unless visual
   inspection finds gaps. [Can I Use](https://caniuse.com/css-widows-orphans),
   [Chrome hyphens](https://developer.chrome.com/blog/css-hyphens)

## Out of scope

- Real Claude integration (fixtures simulate Claude output)
- `src/` production code (Phase 3)
- A4 or non-Letter paper sizes
- Two-column / sidebar layouts
- Cover letter rendering (still `md-to-pdf`)
- Application-layer retry loop (Phase 3 `tailorApplicationService`)
