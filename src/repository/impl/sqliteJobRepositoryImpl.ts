import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { and, eq, gte, inArray, like, lte, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { ArtifactKind, JobRepository } from '../jobRepository.js';
import type { CompanyRepository } from '../companyRepository.js';
import type { Job, JobQuery, JobStatus, JobUpdate } from '../../utils/types/job.js';
import { ALL_JOB_STATUSES } from '../../utils/types/job.js';
import type { DrizzleDb } from './drizzleDb.js';
import { companies, jobs } from './schema.js';
import { jobDir } from '../../utils/workspacePaths.js';

/**
 * Persists job rows in SQLite and the JD text in `<workspace>/data/jobs/<dir>/jd.md`.
 * Metadata stays in SQL; prose content (jd.md) lives on disk for greppability.
 */
export class SqliteJobRepositoryImpl implements JobRepository {
  constructor(
    private readonly db: DrizzleDb,
    private readonly companyRepository: CompanyRepository,
    private readonly workspaceDir: string,
  ) {}

  async get(id: string): Promise<Job | null> {
    const rows = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.id, id))
      .limit(1);
    return rows.length > 0 ? rowToJob(rows[0]) : null;
  }

  async save(job: Job): Promise<void> {
    await this.db.insert(jobs).values(jobToRow(job));
  }

  async saveMany(jobList: Job[]): Promise<void> {
    for (const job of jobList) {
      await this.save(job);
    }
  }

  async query(q: JobQuery): Promise<Job[]> {
    // Two paths so the non-search case stays a plain SELECT FROM jobs —
    // no pointless join. Search needs the companies table to match
    // company names in the same OR group as title/location.
    if (hasSearch(q)) {
      return this.querySearch(q);
    }

    const conditions = buildBaseConditions(q);
    const baseQuery = conditions.length > 0
      ? this.db.select().from(jobs).where(and(...conditions))
      : this.db.select().from(jobs);
    const rows = q.limit !== undefined
      ? await baseQuery.limit(q.limit)
      : await baseQuery;
    return rows.map(rowToJob);
  }

  // Search path — joins companies so LIKE can match against company.name.
  // Select wraps the job row in `{ job: jobs }` because Drizzle needs an
  // explicit projection once a join is present.
  private async querySearch(q: JobQuery): Promise<Job[]> {
    const conditions = buildConditionsWithSearch(q);
    const base = this.db
      .select({ job: jobs })
      .from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(...conditions));
    const rows = q.limit !== undefined
      ? await base.limit(q.limit)
      : await base;
    return rows.map((r) => rowToJob(r.job));
  }

  async update(id: string, patch: JobUpdate): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(jobs)
      .set({ ...patch, updatedAt: now })
      .where(eq(jobs.id, id));
  }

  async updateMany(ids: string[], patch: JobUpdate): Promise<void> {
    for (const id of ids) {
      await this.update(id, patch);
    }
  }

  async countByStatus(): Promise<Record<JobStatus, number>> {
    const rows = await this.db
      .select({ status: jobs.status, count: sql<number>`count(*)` })
      .from(jobs)
      .groupBy(jobs.status);

    const result = Object.fromEntries(
      ALL_JOB_STATUSES.map((s) => [s, 0])
    ) as Record<JobStatus, number>;

    for (const row of rows) {
      if (row.status in result) {
        result[row.status as JobStatus] = Number(row.count);
      }
    }

    return result;
  }

  async countAll(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(jobs);
    return Number(row?.count ?? 0);
  }

  async countWithTailoredResume(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(eq(jobs.hasTailoredResume, true));
    return Number(row?.count ?? 0);
  }

  async countWithoutCompleteTailor(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(or(
        eq(jobs.hasTailoredResume, false),
        eq(jobs.hasTailoredCoverLetter, false),
      ));
    return Number(row?.count ?? 0);
  }

  async countMatching(q: JobQuery): Promise<number> {
    // Mirror query()'s two paths so the two helpers can't drift — the parity
    // tests in __tests__/sqliteJobRepositoryImpl.test.ts enforce this.
    if (hasSearch(q)) {
      const conditions = buildConditionsWithSearch(q);
      const [row] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(jobs)
        .leftJoin(companies, eq(jobs.companyId, companies.id))
        .where(and(...conditions));
      return Number(row?.count ?? 0);
    }

    const conditions = buildBaseConditions(q);
    const [row] = conditions.length > 0
      ? await this.db.select({ count: sql<number>`count(*)` }).from(jobs).where(and(...conditions))
      : await this.db.select({ count: sql<number>`count(*)` }).from(jobs);
    return Number(row?.count ?? 0);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(jobs).where(eq(jobs.id, id));
  }

  async getWorkspaceDir(id: string): Promise<string> {
    const job = await this.get(id);
    if (!job) throw new Error(`Job not found: ${id}`);
    const company = await this.companyRepository.get(job.companyId);
    if (!company) throw new Error(`Company not found for job ${id}: ${job.companyId}`);
    return jobDir(this.workspaceDir, company.name, job.title, id);
  }

  async readJdText(id: string): Promise<string> {
    // v2: JD prose lives in the `description_md` column. Old `data/jobs/
    // <dir>/jd.md` files are migrated by v1ToV2 and deleted; we never
    // touch them at runtime any more.
    const rows = await this.db
      .select({ descriptionMd: jobs.descriptionMd })
      .from(jobs)
      .where(eq(jobs.id, id))
      .limit(1);
    if (rows.length === 0) throw new Error(`Job not found: ${id}`);
    return rows[0].descriptionMd;
  }

  async writeJdText(id: string, jdText: string): Promise<void> {
    // Ensure the per-job artifact dir exists (tailor's resume.pdf /
    // cover_letter.pdf still land there). The dir is no longer used for
    // jd.md, but tailor / fill writers expect it.
    const dir = await this.getWorkspaceDir(id);
    await mkdir(dir, { recursive: true });
    const result = await this.db
      .update(jobs)
      .set({ descriptionMd: jdText, updatedAt: new Date().toISOString() })
      .where(eq(jobs.id, id));
    // Drizzle's better-sqlite3 driver returns a `RunResult`-shaped object;
    // we don't strictly need to inspect it (a missing job would have
    // produced 0 rows updated, which is fine — the tailor flow does its
    // own existence check via get()).
    void result;
  }

  async getArtifactPath(id: string, kind: ArtifactKind): Promise<string> {
    // β.10h: convention paths under the per-job workspace dir. The booleans
    // (hasTailoredResume etc.) on the Job row tell callers whether the
    // artifact has been produced; the path is always derivable.
    const dir = await this.getWorkspaceDir(id);
    switch (kind) {
      case 'resume_pdf':         return path.join(dir, 'resume.pdf');
      case 'cover_letter_html':  return path.join(dir, 'src', 'cover_letter.html');
      case 'cover_letter_pdf':   return path.join(dir, 'cover_letter.pdf');
      case 'screenshot_dir':     return path.join(dir, 'screenshots');
      case 'outreach_draft':     return path.join(dir, 'outreach.eml');
    }
  }
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

// True when the query requires a join with `companies` to evaluate the
// search predicate against company name. Decides which code path in
// query() / countMatching() to take.
function hasSearch(q: JobQuery): boolean {
  return q.search !== undefined && q.search.length > 0;
}

// Base conditions that only reference the jobs table — no join needed.
// Used directly by the non-search path and wrapped inside
// buildConditionsWithSearch() for the search path.
function buildBaseConditions(q: JobQuery): SQL[] {
  const conditions: SQL[] = [];

  if (q.status !== undefined) {
    if (Array.isArray(q.status)) {
      conditions.push(inArray(jobs.status, q.status));
    } else {
      conditions.push(eq(jobs.status, q.status));
    }
  }

  if (q.companyIds !== undefined && q.companyIds.length > 0) {
    conditions.push(inArray(jobs.companyId, q.companyIds));
  }

  if (q.minScore !== undefined) {
    conditions.push(gte(jobs.score, q.minScore));
  }

  if (q.start !== undefined) {
    conditions.push(gte(jobs.createdAt, q.start));
  }

  if (q.end !== undefined) {
    conditions.push(lte(jobs.createdAt, q.end));
  }

  if (q.source !== undefined) {
    conditions.push(eq(jobs.source, q.source));
  }

  return conditions;
}

// Conditions for the search path. Same base conditions PLUS a search OR
// that spans title / location / company.name. Assumes the caller has
// joined `companies` onto `jobs`.
function buildConditionsWithSearch(q: JobQuery): SQL[] {
  const conditions = buildBaseConditions(q);

  if (!hasSearch(q)) return conditions;

  // Each term becomes its own (title OR location OR company.name) predicate.
  // Multiple terms are OR'd at the top level, so `--search A --search B`
  // widens the match to rows matching either.
  const perTermPredicates: SQL[] = [];
  for (const rawTerm of q.search!) {
    const term = rawTerm.trim();
    if (term.length === 0) continue;
    const pattern = `%${term}%`;
    const termPredicate = or(
      like(jobs.title, pattern),
      like(jobs.location, pattern),
      like(companies.name, pattern),
    );
    if (termPredicate !== undefined) {
      perTermPredicates.push(termPredicate);
    }
  }

  if (perTermPredicates.length === 1) {
    conditions.push(perTermPredicates[0]);
  } else if (perTermPredicates.length > 1) {
    const combined = or(...perTermPredicates);
    if (combined !== undefined) {
      conditions.push(combined);
    }
  }

  return conditions;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

type JobRow = typeof jobs.$inferSelect;

// Drizzle's `$inferSelect` already types every nullable column as `T | null`,
// so the rowToJob mapper can pass those fields through directly — no
// defensive `?? null` needed. The insert-side mapper below still coalesces
// to `undefined` because `$inferInsert` shapes optional columns that way.
function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    companyId: row.companyId,
    url: row.url,
    source: row.source,
    location: row.location,
    remote: row.remote,
    salaryLow: row.salaryLow,
    salaryHigh: row.salaryHigh,
    workAuthorizationRequired: row.workAuthorizationRequired,
    clearanceRequired: row.clearanceRequired,
    score: row.score,
    scoreJustification: row.scoreJustification,
    status: row.status,
    error: row.error,
    appliedProfileId: row.appliedProfileId,
    hasTailoredResume: row.hasTailoredResume,
    hasTailoredCoverLetter: row.hasTailoredCoverLetter,
    hasScreenshots: row.hasScreenshots,
    hasOutreachDraft: row.hasOutreachDraft,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function jobToRow(job: Job): typeof jobs.$inferInsert {
  return {
    id: job.id,
    title: job.title,
    companyId: job.companyId,
    url: job.url,
    source: job.source,
    location: job.location,
    remote: job.remote,
    salaryLow: job.salaryLow ?? undefined,
    salaryHigh: job.salaryHigh ?? undefined,
    workAuthorizationRequired: job.workAuthorizationRequired,
    clearanceRequired: job.clearanceRequired,
    score: job.score ?? undefined,
    scoreJustification: job.scoreJustification ?? undefined,
    status: job.status,
    error: job.error ?? undefined,
    appliedProfileId: job.appliedProfileId ?? undefined,
    hasTailoredResume: job.hasTailoredResume,
    hasTailoredCoverLetter: job.hasTailoredCoverLetter,
    hasScreenshots: job.hasScreenshots,
    hasOutreachDraft: job.hasOutreachDraft,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
