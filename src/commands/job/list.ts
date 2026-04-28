import { createAppContext, type AppContext } from '../../cli/appContext.js';
import {
  DEFAULT_JOB_LIST_LIMIT,
  type JobListItem,
  type JobListOptions,
  type JobListResult,
} from '../../utils/types/commands.js';
import { ALL_JOB_STATUSES, type JobQuery } from '../../utils/types/job.js';

const ID_WIDTH = 8;

/**
 * Reject bad CLI input at the command boundary rather than letting it reach
 * SQL and silently return zero rows. Commander hands us raw strings; this
 * function narrows them back to typed domain values or throws a helpful
 * error. `source` is intentionally *not* validated — JobSource is an open-
 * ended enum by design (providers can extend it at runtime).
 */
function validateAndNormalize(options: JobListOptions): JobListOptions {
  const normalized: JobListOptions = { ...options };

  // --status may come as a single string or an array. Validate each entry
  // against ALL_JOB_STATUSES and preserve the caller's shape so downstream
  // SQL stays eq(...) for single and inArray(...) for array.
  if (options.status !== undefined) {
    const values = Array.isArray(options.status) ? options.status : [options.status];
    for (const s of values) {
      const valid = (ALL_JOB_STATUSES as readonly string[]).includes(s);
      if (!valid) {
        throw new Error(
          `Invalid --status "${s}". Valid statuses: ${ALL_JOB_STATUSES.join(', ')}`,
        );
      }
    }
  }

  // --min-score must be a real number. parseFloat returns NaN for junk,
  // which silently matches zero rows at the SQL layer if not rejected here.
  if (options.minScore !== undefined && !Number.isFinite(options.minScore)) {
    throw new Error(`--min-score must be a finite number (got "${options.minScore}")`);
  }

  // --start / --end accept either ISO-8601 or plain YYYY-MM-DD. Parse,
  // reject garbage, normalize to canonical ISO so lexicographic string
  // comparison on `createdAt` is reliable.
  if (options.start !== undefined) {
    normalized.start = normalizeDateOrThrow(options.start, '--start');
  }
  if (options.end !== undefined) {
    normalized.end = normalizeDateOrThrow(options.end, '--end');
  }

  // --limit must be a positive integer. Prevents commander from handing SQL
  // a garbage LIMIT clause when a user types `--limit foo` or `--limit 0`.
  if (options.limit !== undefined) {
    const limit = options.limit;
    const valid = Number.isInteger(limit) && limit >= 1;
    if (!valid) {
      throw new Error(`--limit must be a positive integer (got "${limit}")`);
    }
  }

  // --search must be an array of non-empty strings. Commander's repeatable
  // collector gives us an array; blank entries would be useless to the
  // SQL `LIKE '%%'` (matches everything) so we reject them early.
  if (options.search !== undefined) {
    for (const term of options.search) {
      if (typeof term !== 'string' || term.trim().length === 0) {
        throw new Error('--search terms must be non-empty strings');
      }
    }
  }

  return normalized;
}

// Parses a date string and returns its canonical ISO form. The flagName
// argument is threaded in so error messages tell the user exactly which
// option to fix. Throws on unparseable input.
function normalizeDateOrThrow(raw: string, flagName: string): string {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `${flagName} must be a valid ISO-8601 date (got "${raw}"). ` +
        'Examples: 2026-04-01, 2026-04-18T10:00:00Z.',
    );
  }
  return parsed.toISOString();
}

/**
 * `wolf job list` — the filtered list view. Every filter maps 1:1 to a
 * predicate on the SQL query; nothing is post-filtered in JS.
 *
 * Search terms match substrings (case-insensitive) across the job's title,
 * location, and its company's name. Multiple --search terms are OR'd at the
 * top level — more terms widens the match.
 *
 * Company-name display resolution still happens in this layer (jobs table
 * only carries companyId), but that is output-shaping, not filtering.
 */
export async function jobList(
  options: JobListOptions = {},
  ctx: AppContext = createAppContext(),
): Promise<JobListResult> {
  const opts = validateAndNormalize(options);

  const limit = opts.limit ?? DEFAULT_JOB_LIST_LIMIT;

  const query: JobQuery = {
    status: opts.status,
    minScore: opts.minScore,
    start: opts.start,
    end: opts.end,
    source: opts.source,
    search: opts.search,
    limit,
  };

  // Kick off the data fetch and the match count in parallel so the overflow
  // footer stays accurate without adding user-visible latency. `countMatching`
  // ignores `limit` by contract (asserted in the repo tests), so we pass the
  // same query through to both calls.
  const [rows, totalMatching] = await Promise.all([
    ctx.jobRepository.query(query),
    ctx.jobRepository.countMatching(query),
  ]);

  // Resolve each row's company name for display. Cache per-call so a page
  // of 20 jobs doesn't hit SQLite 20 times when several jobs share one
  // company.
  const nameCache = new Map<string, string>();
  const items: JobListItem[] = [];
  for (const job of rows) {
    let name = nameCache.get(job.companyId);
    if (name === undefined) {
      const company = await ctx.companyRepository.get(job.companyId);
      name = company?.name ?? `<unknown:${job.companyId}>`;
      nameCache.set(job.companyId, name);
    }
    items.push({
      id: job.id,
      company: name,
      title: job.title,
      status: job.status,
      score: job.score,
      createdAt: job.createdAt,
    });
  }

  return {
    jobs: items,
    totalMatching,
    limited: totalMatching > items.length,
  };
}

/**
 * CLI-edge wrapper around `jobList`. Catches validation errors from
 * `validateAndNormalize` and renders them as a friendly stderr line plus
 * exitCode=1 instead of letting them escape into Node's unhandled-error
 * formatter (which dumps a stack trace under the message). Programmatic
 * callers should keep using `jobList` directly — its throw-on-bad-input
 * contract is unchanged.
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
 * when applicable. Pure function over the result so the CLI layer stays
 * thin and the output is unit-testable without any AppContext setup.
 *
 * The `--json` flag is handled at the CLI layer, not here — this formatter
 * produces the human-readable shape only.
 */
export function formatJobList(result: JobListResult): string {
  if (result.jobs.length === 0) return 'No jobs match.';

  // Each column's width is the max of its header text and the widest cell
  // in the current page. Keeps the table tight without hard-coding widths.
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
