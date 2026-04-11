// poc/html-rendering/fit.ts
// Standalone POC. NOT part of production code under src/.
//
// Iteratively adjusts 3 CSS variables on the shell (--font-size, --line-height,
// --margin-in) until document.body.scrollHeight fits one Letter page, then
// calls page.pdf() to produce the final PDF. Throws CannotFitError if the
// adjustment floor is exhausted without converging — caller's responsibility
// to ask Claude to shorten the content and retry.

import type { Page } from 'playwright';

export interface FitParams {
  fontSize: number;       // pt
  lineHeight: number;     // multiplier
  marginIn: number;       // inches
  sectionGap: number;     // em — gap above each h2 section header
}

export interface TraceEntry {
  iter: number;
  params: FitParams;
  scrollHeight: number;
  pageHeightPx: number;
}

export interface FitResult {
  pdf: Buffer;
  finalParams: FitParams;
  iterations: number;
  trace: TraceEntry[];
}

export class CannotFitError extends Error {
  constructor(public readonly lastAttempt: FitResult) {
    super(`Could not fit content after ${lastAttempt.iterations} iterations`);
    this.name = 'CannotFitError';
  }
}

/**
 * Raised when raw content is sparse enough that even the maximum section-gap
 * expansion can't reach the target fill threshold. Caller (Phase 3 application
 * layer) should treat this as "content too short — ask Claude to add material".
 */
export class CannotFillError extends Error {
  constructor(public readonly lastAttempt: FitResult) {
    super(`Could not fill page to target after max section-gap expansion`);
    this.name = 'CannotFillError';
  }
}

const DEFAULTS: FitParams = { fontSize: 11, lineHeight: 1.3, marginIn: 0.5, sectionGap: 0.85 };
const FLOORS: FitParams = { fontSize: 9.5, lineHeight: 1.1, marginIn: 0.3, sectionGap: 0.85 };
const STEPS: FitParams = { fontSize: 0.5, lineHeight: 0.05, marginIn: 0.05, sectionGap: 0 };

// Maximum section-gap the fill path may try before escalating to font growth.
// 2em keeps the visual "padding" subtle — beyond this, empty space starts
// looking like a layout bug rather than intentional breathing room.
const SECTION_GAP_MAX = 2;

// Maximum fontSize the fill path may grow to when section-gap alone isn't
// enough. Grows from the 11pt default. 14pt is noticeably larger but still
// passes for "generous" typography on a short resume.
const FONT_SIZE_MAX = 14;

// Minimum acceptable fill ratio when expanding. If even max section-gap AND
// max fontSize can't push scrollHeight above (target * FILL_MIN_SAFETY),
// throw CannotFillError.
const FILL_MIN_SAFETY = 0.95;

// Safety margin for the scrollHeight → page height comparison. Real Chromium
// PDF rendering has DPI quirks; 0.98 absorbs them while still letting the
// binary search converge close to a full page.
const SAFETY = 0.98;

const MAX_ITERATIONS = 12;
const REFINE_ITERATIONS = 5;
const LETTER_WIDTH_IN = 8.5;
const LETTER_HEIGHT_IN = 11;
const DPI = 96;
const OVERRIDE_STYLE_ID = '__fit_overrides__';

function buildOverrideCss(p: FitParams): string {
  // The `body#resume-root h2` selector has higher specificity (0,1,0,2) than
  // the body fixture's plain `h2` rule (0,0,0,1), so the injected margin-top
  // always wins — even if the body's CSS uses a `margin:` shorthand.
  return `:root {
  --font-size: ${p.fontSize}pt;
  --line-height: ${p.lineHeight};
  --margin-in: ${p.marginIn}in;
  --section-gap: ${p.sectionGap}em;
}
body#resume-root h2 {
  margin-top: var(--section-gap);
}`;
}

async function setPrintViewport(page: Page, marginIn: number): Promise<void> {
  // Match the viewport to the printable area so DOM layout (and therefore
  // scrollHeight) reflects the actual print layout. Without this the default
  // 1280x720 viewport gives a wider column and underestimates content height.
  const width = Math.round((LETTER_WIDTH_IN - 2 * marginIn) * DPI);
  const height = Math.round((LETTER_HEIGHT_IN - 2 * marginIn) * DPI);
  await page.setViewportSize({ width, height });
}

async function injectOverride(page: Page, params: FitParams): Promise<void> {
  await setPrintViewport(page, params.marginIn);
  await page.evaluate(
    ({ id, css }: { id: string; css: string }) => {
      let tag = document.getElementById(id) as HTMLStyleElement | null;
      if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
        document.head.appendChild(tag);
      }
      tag.textContent = css;
    },
    { id: OVERRIDE_STYLE_ID, css: buildOverrideCss(params) },
  );
  // wait a frame for layout to settle after the style / viewport change
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
}

async function measure(page: Page): Promise<number> {
  return page.evaluate(() => document.body.scrollHeight);
}

async function renderPdf(page: Page): Promise<Buffer> {
  // preferCSSPageSize: true makes Playwright honor the shell's @page rule,
  // which in turn uses the current --margin-in CSS variable. That means we
  // don't need to pass a separate margin object to page.pdf() — one source
  // of truth for page geometry.
  return page.pdf({
    printBackground: true,
    preferCSSPageSize: true,
  });
}

function pageHeightPx(marginIn: number): number {
  return (LETTER_HEIGHT_IN - 2 * marginIn) * DPI;
}

function decrement(params: FitParams): FitParams | null {
  if (params.fontSize > FLOORS.fontSize) {
    return { ...params, fontSize: +(Math.max(FLOORS.fontSize, params.fontSize - STEPS.fontSize)).toFixed(3) };
  }
  if (params.lineHeight > FLOORS.lineHeight) {
    return { ...params, lineHeight: +(Math.max(FLOORS.lineHeight, params.lineHeight - STEPS.lineHeight)).toFixed(3) };
  }
  if (params.marginIn > FLOORS.marginIn) {
    return { ...params, marginIn: +(Math.max(FLOORS.marginIn, params.marginIn - STEPS.marginIn)).toFixed(3) };
  }
  return null;
}

/**
 * Run the fit loop. `page` must already have the shell loaded and the
 * Claude-produced body content injected into `#resume-root`.
 *
 * Two entry paths based on initial measurement:
 *
 * 1. **Overflow → shrink path**
 *    Coarse descent (fontSize → lineHeight → marginIn) followed by binary
 *    search refinement on the last-changed attribute. Throws CannotFitError
 *    if the content is so long even at floor params it still overflows.
 *
 * 2. **Underflow → expand path**
 *    Probe max section-gap. If even that can't fill the page to
 *    FILL_MIN_SAFETY, throw CannotFillError. Otherwise binary search the
 *    section-gap for the largest value that still fits, maximizing visual
 *    page fill without overflow.
 */
export async function fit(page: Page, initial: Partial<FitParams> = {}): Promise<FitResult> {
  const params: FitParams = { ...DEFAULTS, ...initial };
  const trace: TraceEntry[] = [];

  // Initial measurement at defaults to decide which path to take.
  await injectOverride(page, params);
  const initialSh = await measure(page);
  const initialTargetPx = pageHeightPx(params.marginIn);
  trace.push({
    iter: trace.length + 1,
    params: { ...params },
    scrollHeight: initialSh,
    pageHeightPx: initialTargetPx,
  });

  if (initialSh > initialTargetPx * SAFETY) {
    return shrinkPath(page, params, trace);
  }
  return expandPath(page, params, trace);
}

/**
 * Content overflows at defaults. Coarse descent + binary-search refinement.
 */
async function shrinkPath(
  page: Page,
  startParams: FitParams,
  trace: TraceEntry[],
): Promise<FitResult> {
  let params = { ...startParams };
  let lastOverflowParams: FitParams = { ...startParams };
  let lastOverflowAttr: keyof FitParams | null = null;

  // Coarse-step descent. The initial measurement is already in trace[0].
  for (let i = 0; i < MAX_ITERATIONS - 1; i++) {
    const next = decrement(params);
    if (!next) {
      const pdf = await renderPdf(page);
      throw new CannotFitError({
        pdf,
        finalParams: params,
        iterations: trace.length,
        trace,
      });
    }

    lastOverflowAttr =
      next.fontSize !== params.fontSize ? 'fontSize'
      : next.lineHeight !== params.lineHeight ? 'lineHeight'
      : 'marginIn';
    params = next;

    await injectOverride(page, params);
    const sh = await measure(page);
    const targetPx = pageHeightPx(params.marginIn);
    trace.push({
      iter: trace.length + 1,
      params: { ...params },
      scrollHeight: sh,
      pageHeightPx: targetPx,
    });

    if (sh <= targetPx * SAFETY) {
      if (lastOverflowAttr) {
        params = await refineBinarySearch(
          page,
          params,
          lastOverflowParams,
          lastOverflowAttr,
          trace,
        );
        await injectOverride(page, params);
      }
      const pdf = await renderPdf(page);
      return { pdf, finalParams: params, iterations: trace.length, trace };
    }

    lastOverflowParams = { ...params };
  }

  const pdf = await renderPdf(page);
  throw new CannotFitError({
    pdf,
    finalParams: params,
    iterations: trace.length,
    trace,
  });
}

/**
 * Content fits at defaults but leaves whitespace at the bottom.
 *
 * Two-phase fill with binary-search refinement:
 * 1. Grow section-gap up to SECTION_GAP_MAX. If enough, commit / refine.
 * 2. With section-gap pinned at max, grow fontSize up to FONT_SIZE_MAX.
 *    If enough, commit / refine. Otherwise CannotFillError.
 */
async function expandPath(
  page: Page,
  startParams: FitParams,
  trace: TraceEntry[],
): Promise<FitResult> {
  const targetPx = pageHeightPx(startParams.marginIn);
  const initialSh = trace[trace.length - 1].scrollHeight;

  // If raw is already in the acceptable fill band, don't expand at all.
  if (initialSh >= targetPx * FILL_MIN_SAFETY) {
    const pdf = await renderPdf(page);
    return { pdf, finalParams: startParams, iterations: trace.length, trace };
  }

  // --- Phase 1: grow section-gap ---
  const maxGapParams: FitParams = { ...startParams, sectionGap: SECTION_GAP_MAX };
  const maxGapSh = await measureParams(page, maxGapParams, trace);

  if (maxGapSh > targetPx * SAFETY) {
    // Max gap overshoots — binary search for the largest gap that still fits.
    const refined = await refineBinarySearch(
      page,
      startParams,  // known-fitting (default gap)
      maxGapParams, // known-overflowing (max gap)
      'sectionGap',
      trace,
    );
    await injectOverride(page, refined);
    const pdf = await renderPdf(page);
    return { pdf, finalParams: refined, iterations: trace.length, trace };
  }

  if (maxGapSh >= targetPx * FILL_MIN_SAFETY) {
    // Max gap reaches acceptable fill. Commit at max.
    const pdf = await renderPdf(page);
    return { pdf, finalParams: maxGapParams, iterations: trace.length, trace };
  }

  // --- Phase 2: gap already at max, now grow fontSize ---
  const maxFontParams: FitParams = { ...maxGapParams, fontSize: FONT_SIZE_MAX };
  const maxFontSh = await measureParams(page, maxFontParams, trace);

  if (maxFontSh > targetPx * SAFETY) {
    // Font at max overshoots — binary search fontSize (gap pinned at max).
    const refined = await refineBinarySearch(
      page,
      maxGapParams,  // known-fitting at gap max (but below acceptable)
      maxFontParams, // known-overflowing at gap max + font max
      'fontSize',
      trace,
    );
    await injectOverride(page, refined);
    const pdf = await renderPdf(page);
    return { pdf, finalParams: refined, iterations: trace.length, trace };
  }

  if (maxFontSh >= targetPx * FILL_MIN_SAFETY) {
    // Max gap + max font reaches acceptable fill.
    const pdf = await renderPdf(page);
    return { pdf, finalParams: maxFontParams, iterations: trace.length, trace };
  }

  // Still below acceptable fill even at the ceiling of both axes.
  const pdf = await renderPdf(page);
  throw new CannotFillError({
    pdf,
    finalParams: maxFontParams,
    iterations: trace.length,
    trace,
  });
}

/** Inject params, measure scrollHeight, push a trace entry, return the sh. */
async function measureParams(
  page: Page,
  params: FitParams,
  trace: TraceEntry[],
): Promise<number> {
  await injectOverride(page, params);
  const sh = await measure(page);
  const targetPx = pageHeightPx(params.marginIn);
  trace.push({
    iter: trace.length + 1,
    params: { ...params },
    scrollHeight: sh,
    pageHeightPx: targetPx,
  });
  return sh;
}

/**
 * Binary search refinement. Given a known-fitting param set (low, smaller
 * value on `attr`) and a known-overflowing param set (high, larger value),
 * narrow the range to find the largest value of `attr` that still fits.
 * Returns the refined (still-fitting) params.
 */
async function refineBinarySearch(
  page: Page,
  low: FitParams,
  high: FitParams,
  attr: keyof FitParams,
  trace: TraceEntry[],
): Promise<FitParams> {
  let best = low;
  let loVal = low[attr];
  let hiVal = high[attr];

  for (let i = 0; i < REFINE_ITERATIONS; i++) {
    const midVal = +((loVal + hiVal) / 2).toFixed(4);
    const tryParams: FitParams = { ...best, [attr]: midVal };

    await injectOverride(page, tryParams);
    const sh = await measure(page);
    const target = pageHeightPx(tryParams.marginIn);

    trace.push({
      iter: trace.length + 1,
      params: { ...tryParams },
      scrollHeight: sh,
      pageHeightPx: target,
    });

    if (sh <= target * SAFETY) {
      best = tryParams;
      loVal = midVal;
    } else {
      hiVal = midVal;
    }
  }

  return best;
}
