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
      ├── owns: --font-size, --line-height, --margin-in, --section-gap vars
      ├── owns: @page margin rule
      ├── owns: widows / orphans / hyphens baseline typography CSS
      └── loads: Google Fonts (Inter)
      ↓
   fit() function  ──►  pure TS, injects `:root { ... }` style overrides,
                         uses Playwright to measure scrollHeight. Two paths:
      ├── shrink path — fontSize → lineHeight → marginIn floors
      │                 + binary-search refine on last-changed attribute
      └── expand path — sectionGap → fontSize ceilings
      ↓
      ├─ success          → PDF bytes + final params + iteration trace
      ├─ CannotFitError   → content too long; Phase 3 asks Claude to shorten
      └─ CannotFillError  → content too sparse; Phase 3 asks Claude to add more
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

## Failure signaling & Phase 3 retry loop

> **This section is the architectural contract between fit() and the
> Phase 3 `tailorApplicationService`. Do not delete — it's the only place
> this is written down.**

**Claude never sees the PDF or any PNG.** The retry loop operates entirely
on text and numbers. fit() throws one of two typed errors when it can't
produce a one-page result, and each error carries enough information for
the application layer to generate a natural-language instruction for Claude
to fix on the next round.

### The two error types

| Error | Meaning | Root cause |
|---|---|---|
| `CannotFitError` | Content too **long** — even at floor params (fontSize 9.5pt, lineHeight 1.1, margin 0.3in) it overflows one page | Claude generated too much content |
| `CannotFillError` | Content too **short** — even at ceiling params (sectionGap 2em + fontSize 14pt) it can't reach 95% of the page | Claude generated too little content |

Both errors extend `Error` and carry a `lastAttempt: FitResult`, which
contains the final `trace` with `scrollHeight` and `pageHeightPx` recorded
for every iteration.

### Deriving feedback from the trace

The last trace entry has `scrollHeight` (actual content height) and
`pageHeightPx` (target one-page height). Two subtractions give the overflow
or underflow in pixels, which translate directly to an approximate number
of bullets to remove or add.

```typescript
// Phase 3 pseudocode — src/application/impl/tailorApplicationService.ts
try {
  const result = await fit(page);
  return result.pdf;
} catch (e) {
  const last = e.lastAttempt.trace[e.lastAttempt.trace.length - 1];
  const AVG_BULLET_PX = 33;  // ~1.5 visual lines @ 22px/line at 11pt

  if (e instanceof CannotFitError) {
    const overflowPx = last.scrollHeight - last.pageHeightPx * 0.98;
    const bullets = Math.ceil(overflowPx / AVG_BULLET_PX);
    feedback =
      `Current resume overflows by approximately ${bullets} bullets. ` +
      `Remove the ${bullets} weakest accomplishments — prefer trimming ` +
      `older or less role-relevant entries first.`;
  } else if (e instanceof CannotFillError) {
    const underflowPx = last.pageHeightPx * 0.95 - last.scrollHeight;
    const bullets = Math.ceil(underflowPx / AVG_BULLET_PX);
    feedback =
      `Current resume has room for approximately ${bullets} more bullets. ` +
      `Add ${bullets} accomplishments to the strongest experiences — ` +
      `prefer quantified outcomes tied to the job description.`;
  }
  // Prepend `feedback` to the Claude prompt and retry (bounded).
}
```

### Why AI never looks at images

The feedback above is **entirely textual and numerical**. No image analysis,
no vision model, no OCR. Claude acts on "remove 3 bullets" far more
reliably than on "look at this PDF and figure out what's wrong." Consequences:

- **Production wolf doesn't need poppler-utils.** The `pdftoppm` PNG
  rendering in this POC's `render.ts` driver exists purely for human /
  developer review during spike iteration. Phase 3
  `tailorApplicationService` never calls `pdftoppm`, never produces PNGs,
  never ships an image-analysis step.
- **The retry loop is deterministic.** Same content → same overflow
  measurement → same feedback → same Claude prompt. No vision-model noise.
- **Errors compose cleanly.** The application layer can escalate: if after
  N retries the feedback still has the same sign, surface "couldn't fit
  this job's content in a one-pager" to the user and stop — no infinite
  tight-loop on Claude-the-model.

### Optional convenience (not yet implemented)

The `CannotFitError` / `CannotFillError` classes could expose helper getters
like `overflowPx` / `underflowPx` / `estimatedExcessBullets` so the
application layer doesn't need to reach into `lastAttempt.trace` manually.
Left for Phase 3 to add when the actual `tailorApplicationService` is
written.

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
