import { createAppContext, type AppContext } from '../../runtime/appContext.js';
import type { JobListOptions, JobListResult } from '../../utils/types/commands.js';

const ID_WIDTH = 8;

/**
 * `wolf job list` — thin wrapper around JobApplicationService.list.
 */
export async function jobList(
  options: JobListOptions = {},
  ctx: AppContext = createAppContext(),
): Promise<JobListResult> {
  return ctx.jobApp.list(options);
}

/**
 * CLI-edge wrapper around `jobList`. Catches validation errors and renders
 * them as a friendly stderr line plus exitCode=1.
 */
export async function runJobListCli(
  options: JobListOptions,
  asJson: boolean,
  ctx: AppContext = createAppContext(),
): Promise<void> {
  try {
    const result = await jobList(options, ctx);
    console.log(asJson ? JSON.stringify(result, null, 2) : formatJobList(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`error: ${message}`);
    process.exitCode = 1;
  }
}

/**
 * Renders a JobListResult as a fixed-width table with an overflow footer
 * when applicable. Pure formatter.
 */
export function formatJobList(result: JobListResult): string {
  if (result.jobs.length === 0) return 'No jobs match.';

  const widths = {
    id: ID_WIDTH,
    company: Math.max('COMPANY'.length, ...result.jobs.map((j) => j.company.length)),
    title: Math.max('TITLE'.length, ...result.jobs.map((j) => j.title.length)),
    status: Math.max('STATUS'.length, ...result.jobs.map((j) => j.status.length)),
  };

  const headerCells = [
    'ID'.padEnd(widths.id),
    'COMPANY'.padEnd(widths.company),
    'TITLE'.padEnd(widths.title),
    'STATUS'.padEnd(widths.status),
    'SCORE',
  ];
  const header = headerCells.join('  ');

  const rowLines: string[] = [];
  for (const job of result.jobs) {
    const scoreCell = job.score === null ? '-' : job.score.toFixed(1);
    const rowCells = [
      job.id.slice(0, widths.id).padEnd(widths.id),
      job.company.padEnd(widths.company),
      job.title.padEnd(widths.title),
      job.status.padEnd(widths.status),
      scoreCell,
    ];
    rowLines.push(rowCells.join('  '));
  }

  const lines = [header, ...rowLines];
  if (result.limited) {
    const remaining = result.totalMatching - result.jobs.length;
    lines.push('');
    lines.push(`... ${remaining} more — use --limit <n> to see more`);
  }
  return lines.join('\n');
}
