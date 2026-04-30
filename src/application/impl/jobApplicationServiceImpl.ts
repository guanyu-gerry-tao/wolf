import {
  DEFAULT_JOB_LIST_LIMIT,
  type JobListItem,
  type JobListOptions,
  type JobListResult,
} from '../../utils/types/commands.js';
import { ALL_JOB_STATUSES, type Job, type JobQuery, type JobUpdate } from '../../utils/types/job.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { CompanyRepository } from '../../repository/companyRepository.js';
import type {
  JobApplicationService,
  JobShowResult,
  JobSetResult,
} from '../jobApplicationService.js';
import {
  JOB_FIELDS,
  JOB_FIELDS_BY_NAME,
  JOB_SYSTEM_FIELDS,
  type JobFieldMeta,
} from '../../utils/jobFields.js';

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

  /** @inheritdoc */
  async show(id: string): Promise<JobShowResult> {
    const job = await this.requireJob(id);
    const descriptionMd = await this.jobRepository.readJdText(id).catch(() => '');
    const company = await this.companyRepository.get(job.companyId);
    const companyName = company?.name ?? `<unknown:${job.companyId}>`;
    return {
      fields: { ...job } as Record<string, unknown>,
      descriptionMd,
      companyName,
    };
  }

  /** @inheritdoc */
  async getField(id: string, name: string): Promise<string> {
    if (!isKnownField(name)) {
      throw new Error(`Unknown job field "${name}". Run \`wolf job fields\` to list available fields.`);
    }
    if (name === 'description_md') {
      return await this.jobRepository.readJdText(id).catch(() => '');
    }
    const job = await this.requireJob(id);
    const v = (job as unknown as Record<string, unknown>)[name];
    return stringifyForOutput(v);
  }

  /** @inheritdoc */
  async setField(id: string, name: string, valueStr: string): Promise<JobSetResult> {
    if (JOB_SYSTEM_FIELDS.includes(name)) {
      throw new Error(`Field "${name}" is system-managed and cannot be set.`);
    }
    const meta = JOB_FIELDS_BY_NAME.get(name);
    if (!meta) {
      throw new Error(`Unknown job field "${name}". Run \`wolf job fields\` to list available fields.`);
    }

    // description_md is special — stored in a SQLite column accessed via
    // a dedicated repo method (not part of the Job interface).
    if (name === 'description_md') {
      const oldValue = await this.jobRepository.readJdText(id).catch(() => '');
      await this.jobRepository.writeJdText(id, valueStr);
      return { id, field: name, oldValue, newValue: valueStr };
    }

    // Read existing row to capture the before-value for CLI display, and to
    // surface "row missing" as a clean error before we touch the writer.
    const job = await this.requireJob(id);
    const oldValue = stringifyForOutput((job as unknown as Record<string, unknown>)[name]);
    const coerced = coerceFieldValue(meta, valueStr);
    // Single-column UPDATE — drizzle's set() touches only the patched key
    // plus updatedAt. Cleaner than save() (INSERT-OR-REPLACE rewrites every
    // column) and concurrency-safer if other writers are patching the row.
    const patch = { [name]: coerced } as JobUpdate;
    await this.jobRepository.update(id, patch);
    return { id, field: name, oldValue, newValue: stringifyForOutput(coerced) };
  }

  /** @inheritdoc */
  fields(opts: { requiredOnly?: boolean; name?: string } = {}): JobFieldMeta[] {
    if (opts.name) {
      const m = JOB_FIELDS_BY_NAME.get(opts.name);
      return m ? [m] : [];
    }
    return opts.requiredOnly ? JOB_FIELDS.filter((f) => f.required) : [...JOB_FIELDS];
  }

  private async requireJob(id: string): Promise<Job> {
    const job = await this.jobRepository.get(id);
    if (!job) throw new Error(`Job not found: ${id}`);
    return job;
  }
}

// ---------------------------------------------------------------------------
// Field-set helpers (coercion + stringification)
// ---------------------------------------------------------------------------

/** Whether the name is in JOB_FIELDS or one of the system-managed columns
 *  (system-managed fields are readable via `wolf job get` for symmetry with
 *  `wolf job show`, but rejected by `set`). */
function isKnownField(name: string): boolean {
  return JOB_FIELDS_BY_NAME.has(name) || JOB_SYSTEM_FIELDS.includes(name);
}

/** Print any Job column value as a human-readable single-token string. Null
 *  / undefined → ''. Booleans → 'true' / 'false'. Numbers → String(n).
 *  Strings → as-is. */
function stringifyForOutput(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/** Coerce a raw CLI string to the field's runtime type. Throws with a
 *  user-readable message on bad input. */
function coerceFieldValue(meta: JobFieldMeta, raw: string): unknown {
  switch (meta.type) {
    case 'string':
    case 'multilineString':
      if (meta.required && raw.trim().length === 0) {
        throw new Error(`Field "${meta.name}" is required and cannot be empty.`);
      }
      return raw;

    case 'number': {
      if (raw.trim().length === 0) {
        if (meta.required) throw new Error(`Field "${meta.name}" is required.`);
        return null;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        throw new Error(`Field "${meta.name}" must be a number (got "${raw}").`);
      }
      return n;
    }

    case 'boolean': {
      const v = raw.trim().toLowerCase();
      if (v === 'true' || v === 'yes' || v === '1') return true;
      if (v === 'false' || v === 'no' || v === '0') return false;
      throw new Error(`Field "${meta.name}" must be a boolean — true/false, yes/no, or 1/0 (got "${raw}").`);
    }

    case 'enum': {
      const values = meta.enumValues ?? [];
      if (!values.includes(raw)) {
        throw new Error(
          `Field "${meta.name}" must be one of: ${values.join(', ')} (got "${raw}").`,
        );
      }
      return raw;
    }

    case 'nullableString': {
      // Empty string OR literal 'null' / '-' clears the field.
      const trimmed = raw.trim();
      if (trimmed.length === 0 || trimmed === 'null' || trimmed === '-') return null;
      return raw;
    }

    case 'nullableEnum': {
      const trimmed = raw.trim();
      if (trimmed.length === 0 || trimmed === 'null' || trimmed === '-') return null;
      const values = meta.enumValues ?? [];
      if (!values.includes(raw)) {
        throw new Error(
          `Field "${meta.name}" must be one of: ${values.join(', ')} (or blank to clear; got "${raw}").`,
        );
      }
      return raw;
    }
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
