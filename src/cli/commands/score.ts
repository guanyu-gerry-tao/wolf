import type { ScoreOptions, ScoreResult } from '../../utils/types/index.js';
import { createAppContext, type AppContext } from '../../runtime/appContext.js';
import { TIER_NAMES } from '../../utils/scoringTiers.js';

/**
 * `wolf score` entrypoint. Thin wrapper around `ScoreApplicationService`;
 * the AppContext is constructed lazily so unit tests can inject a fake.
 *
 * Three execution modes are dispatched by `ScoreOptions`:
 *
 *   - `single: true`  synchronous one-job tier verdict via `scoreOne`;
 *                     returns `singleTier` + `singleTierName` + `singleMd`
 *                     for inline display.
 *   - `poll: true`    drain pending score batches and write tier_ai +
 *                     scoreJustification back to Job rows.
 *   - default         enqueue every unscored job into the Anthropic Batch API.
 */
export async function score(
  options: ScoreOptions,
  ctx: AppContext = createAppContext(),
): Promise<ScoreResult> {
  return ctx.scoreApp.score(options);
}

/** One of the three CLI output shapes — picked by the action handler. */
export type ScoreMode = 'default' | 'single' | 'poll';

/**
 * Render a `ScoreResult` for the terminal.
 *
 * - `default` mode: how many jobs were enqueued + reminder to poll.
 * - `single` mode: prints the markdown blob the AI produced (## Tier /
 *   ## Pros / ## Cons).
 * - `poll` mode: how many batches were drained + inspection hint.
 */
export function formatScoreResult(result: ScoreResult, mode: ScoreMode): string {
  if (mode === 'poll') {
    const polled = result.polled ?? 0;
    if (polled === 0) {
      return 'Polled 0 batches. No completed score batches to apply.';
    }
    return `Polled ${polled} batch${polled === 1 ? '' : 'es'}. Run \`wolf job list --tier tailor,invest\` to inspect strong matches.`;
  }
  if (mode === 'single') {
    // singleMd already includes the canonical ## Tier / ## Pros / ## Cons
    // sections, so just print it. Fall back to a one-line summary if for
    // some reason the markdown is missing (defensive — should not happen).
    if (result.singleMd) return result.singleMd.trimEnd();
    if (result.singleTierName) return `Tier: ${result.singleTierName}`;
    return 'Score completed (no detail available).';
  }
  // default (batch submit)
  if (result.submitted === 0) {
    return 'No unscored jobs found. Run `wolf hunt` first or pass --jobs <id> to re-score.';
  }
  return `Submitted ${result.submitted} job${result.submitted === 1 ? '' : 's'} to the AI Batch API. ` +
         `Run \`wolf score --poll\` later to retrieve results. Tiers: ${TIER_NAMES.join(' / ')}.`;
}
