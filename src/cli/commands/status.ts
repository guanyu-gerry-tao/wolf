import { createAppContext, type AppContext } from '../../runtime/appContext.js';
import type { StatusOptions } from '../../utils/types/commands.js';
import type { StatusSummary } from '../../application/statusApplicationService.js';

/**
 * Returns the aggregate dashboard: one counter per registered contributor
 * (tracked, tailored, applied, etc.). Intentionally takes no filters — the
 * per-noun list commands (`wolf job list`, later `wolf company list`) own
 * filter-and-inspect duties so status never grows with every new feature.
 */
export async function status(
  _options: StatusOptions = {},
  ctx: AppContext = createAppContext(),
): Promise<StatusSummary> {
  return ctx.statusApp.getSummary();
}

/**
 * Renders a StatusSummary as aligned `label  count` lines for terminal
 * display. Pure function over the result — kept out of the CLI layer so
 * it's unit-testable without spinning up AppContext.
 *
 * Failed counters are annotated inline with `[error: ...]` so a single
 * broken counter never hides the rest of the dashboard.
 */
export function formatStatus(summary: StatusSummary): string {
  if (summary.counters.length === 0) return '';
  const labelWidth = Math.max(...summary.counters.map((c) => c.label.length));
  return summary.counters
    .map((c) => {
      const base = `${c.label.padEnd(labelWidth)}  ${c.count}`;
      return c.error ? `${base}   [error: ${c.error}]` : base;
    })
    .join('\n');
}
