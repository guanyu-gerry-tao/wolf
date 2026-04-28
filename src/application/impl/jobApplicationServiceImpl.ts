import {
  DEFAULT_JOB_LIST_LIMIT,
  type JobListItem,
  type JobListOptions,
  type JobListResult,
} from '../../utils/types/commands.js';
import { ALL_JOB_STATUSES, type JobQuery } from '../../utils/types/job.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { CompanyRepository } from '../../repository/companyRepository.js';
import type { JobApplicationService } from '../jobApplicationService.js';

/**
 * SQLite-backed `JobApplicationService`. Runs `query` and `countMatching`
 * in parallel through `JobRepository` so the overflow footer stays accurate
 * without adding user-visible latency. Caches company-name lookups per call
 * to guard against N+1 against `CompanyRepository`.
 */
export class JobApplicationServiceImpl implements JobApplicationService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly companyRepository: CompanyRepository,
  ) {}

  /** @inheritdoc */
  async list(options: JobListOptions): Promise<JobListResult> {
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
    // footer stays accurate without adding user-visible latency.
    const [rows, totalMatching] = await Promise.all([
      this.jobRepository.query(query),
      this.jobRepository.countMatching(query),
    ]);

    // Resolve each row's company name for display; cache per-call so a page
    // of 20 jobs doesn't hit SQLite 20 times when several jobs share a company.
    const nameCache = new Map<string, string>();
    const items: JobListItem[] = [];
    for (const job of rows) {
      let name = nameCache.get(job.companyId);
      if (name === undefined) {
        const company = await this.companyRepository.get(job.companyId);
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
}

// Reject bad CLI input at the application boundary rather than letting it
// reach SQL and silently return zero rows.
function validateAndNormalize(options: JobListOptions): JobListOptions {
  const normalized: JobListOptions = { ...options };

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

  if (options.minScore !== undefined && !Number.isFinite(options.minScore)) {
    throw new Error(`--min-score must be a finite number (got "${options.minScore}")`);
  }

  if (options.start !== undefined) {
    normalized.start = normalizeDateOrThrow(options.start, '--start');
  }
  if (options.end !== undefined) {
    normalized.end = normalizeDateOrThrow(options.end, '--end');
  }

  if (options.limit !== undefined) {
    const limit = options.limit;
    const valid = Number.isInteger(limit) && limit >= 1;
    if (!valid) {
      throw new Error(`--limit must be a positive integer (got "${limit}")`);
    }
  }

  if (options.search !== undefined) {
    for (const term of options.search) {
      if (typeof term !== 'string' || term.trim().length === 0) {
        throw new Error('--search terms must be non-empty strings');
      }
    }
  }

  return normalized;
}

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
