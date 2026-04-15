import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import type { JobRepository } from '../jobRepository.js';
import type { Job, JobQuery, JobStatus, JobUpdate } from '../../types/job.js';
import type { DrizzleDb } from './drizzleDb.js';
import { jobs } from './schema.js';

const ALL_STATUSES: JobStatus[] = [
  'new',
  'reviewed',
  'ignored',
  'filtered',
  'applied',
  'interview',
  'offer',
  'rejected',
  'closed',
  'error',
];

export class SqliteJobRepositoryImpl implements JobRepository {
  constructor(private readonly db: DrizzleDb) {}

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
    const conditions = [];

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

    if (q.since !== undefined) {
      conditions.push(gte(jobs.createdAt, q.since));
    }

    if (q.source !== undefined) {
      conditions.push(eq(jobs.source, q.source));
    }

    const rows = await (q.limit !== undefined
      ? this.db
          .select()
          .from(jobs)
          .where(and(...conditions))
          .limit(q.limit)
      : this.db
          .select()
          .from(jobs)
          .where(and(...conditions)));

    return rows.map(rowToJob);
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
      ALL_STATUSES.map((s) => [s, 0])
    ) as Record<JobStatus, number>;

    for (const row of rows) {
      if (row.status in result) {
        result[row.status as JobStatus] = Number(row.count);
      }
    }

    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(jobs).where(eq(jobs.id, id));
  }
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

type JobRow = typeof jobs.$inferSelect;

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    companyId: row.companyId,
    url: row.url,
    source: row.source,
    description: row.description,
    location: row.location,
    remote: row.remote,
    salary: row.salary ?? null,
    workAuthorizationRequired: row.workAuthorizationRequired,
    clearanceRequired: row.clearanceRequired,
    score: row.score ?? null,
    scoreJustification: row.scoreJustification ?? null,
    status: row.status,
    error: row.error ?? null,
    appliedProfileId: row.appliedProfileId ?? null,
    tailoredResumeTexPath: row.tailoredResumeTexPath ?? null,
    tailoredResumePdfPath: row.tailoredResumePdfPath ?? null,
    coverLetterMDPath: row.coverLetterMDPath ?? null,
    coverLetterPdfPath: row.coverLetterPdfPath ?? null,
    screenshotPath: row.screenshotPath ?? null,
    outreachDraftPath: row.outreachDraftPath ?? null,
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
    description: job.description,
    location: job.location,
    remote: job.remote,
    salary: job.salary ?? undefined,
    workAuthorizationRequired: job.workAuthorizationRequired,
    clearanceRequired: job.clearanceRequired,
    score: job.score ?? undefined,
    scoreJustification: job.scoreJustification ?? undefined,
    status: job.status,
    error: job.error ?? undefined,
    appliedProfileId: job.appliedProfileId ?? undefined,
    tailoredResumeTexPath: job.tailoredResumeTexPath ?? undefined,
    tailoredResumePdfPath: job.tailoredResumePdfPath ?? undefined,
    coverLetterMDPath: job.coverLetterMDPath ?? undefined,
    coverLetterPdfPath: job.coverLetterPdfPath ?? undefined,
    screenshotPath: job.screenshotPath ?? undefined,
    outreachDraftPath: job.outreachDraftPath ?? undefined,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
