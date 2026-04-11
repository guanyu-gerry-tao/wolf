# HTML Rendering POC — Verdict

**Date:** _(fill in after reviewing PDFs)_
**Reviewer:** Gerry Tao

## Samples evaluated

- `output/resume-short.pdf`        — from `fixtures/body-short.html`
- `output/resume-long.pdf`         — from `fixtures/body-long.html`
- `output/resume-huge-failed.pdf`  — last attempt from `fixtures/body-huge.html` (expected to have overflowed)

## Automated checks (from `render.ts` console output)

- [ ] `body-short` fit in 1 iteration, pdf-lib reports **1 page**
- [ ] `body-long` fit in 2–6 iterations, pdf-lib reports **1 page**
- [ ] `body-huge` threw `CannotFitError` (did NOT silently produce a 2-page PDF)

## Visual checks (eyeball)

- [ ] **Typography** — font rendering crisp, consistent weights, good letter spacing
- [ ] **Layout** — alignment holds, section spacing reads well, header/content ratio OK
- [ ] **Widow / orphan control** — no single-word widows at the end of paragraphs
- [ ] **Hyphenation** — long English words hyphenate sensibly at line ends (or don't, if unnecessary)
- [ ] **Parameter responsiveness** — `long.pdf` at final params is visibly tighter than `short.pdf`, not ugly
- [ ] **Aesthetic CSS intact** — the fixture-level `<style>` rules (borders, uppercase headings, flex rows) appear in all successful PDFs unchanged
- [ ] **No content clipping** — nothing gets cut off the page edges
- [ ] **Heading orphaning** — no section header stranded at the bottom of a page with its content starting the next page (less relevant for one-page output, but check anyway)

## Observations

_(fill in your notes here — anything unexpected, any visual glitches, any
surprises about how many iterations a fixture took, any typography issues
with specific words / paragraphs)_

## Side-by-side with LaTeX

_(optional — if a LaTeX-rendered reference PDF is available, compare directly
and note any qualitative differences in typography, spacing, or overall polish)_

## Verdict

- [ ] **ACCEPT** — HTML quality is production-ready. Proceed with Phase 3
      building `htmlRenderService` on this pattern.
- [ ] **REJECT** — HTML quality is insufficient. Fall back to LaTeX for
      resume rendering in Phase 3.
- [ ] **BORDERLINE** — needs more samples, a real Claude-generated body,
      or CSS tuning before a final call.

## Notes for Phase 3

_(whichever direction is chosen, note any implementation hints — e.g.
"raise fontSize floor to 10pt, the 9.5pt samples look amateur" or "add a
widow npm package post-process step for the long fixture's bottom paragraph")_
