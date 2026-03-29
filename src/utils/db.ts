/**
 * db.ts — Local SQLite database access layer.
 *
 * All wolf commands read and write through this module.
 * No command should import better-sqlite3 or drizzle directly — use these functions instead.
 *
 * Database file: <workspace>/data/wolf.sqlite
 * Created automatically on first use.
 *
 * Schema is defined in schema.ts — the single source of truth for table structure and types.
 */

import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, gte, inArray, sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { companies, jobs, batches } from './schema.js';
import type { Job, JobQuery, JobUpdate, JobStatus } from '../types/index.js';
import type { Company } from '../types/index.js';

type DrizzleDb = ReturnType<typeof drizzle>;

// Module-level singleton — set once by initDb(), used by all other functions.
let db: DrizzleDb | null = null;

function getDb(): DrizzleDb {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Opens (or creates) the SQLite database at <workspace>/data/wolf.sqlite.
 * Creates all tables if they do not exist.
 * Must be called once before any other db function.
 *
 * @param workspaceDir - Absolute path to the workspace directory, or ':memory:' for tests.
 */
export async function initDb(workspaceDir: string): Promise<void> {
  let dbPath: string;
  if (workspaceDir === ':memory:') {
    dbPath = ':memory:';
  } else {
    const dataDir = path.join(workspaceDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    dbPath = path.join(dataDir, 'wolf.sqlite');
  }

  const sqlite = new BetterSqlite3(dbPath);
  db = drizzle(sqlite);

  // Create tables if they don't exist.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT,
      linkedinUrl TEXT,
      size TEXT,
      industry TEXT,
      headquartersLocation TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      companyId TEXT NOT NULL,
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      remote INTEGER NOT NULL,
      salary TEXT,
      workAuthorizationRequired TEXT,
      score REAL,
      scoreJustification TEXT,
      status TEXT NOT NULL,
      appliedProfileId TEXT,
      tailoredResumePath TEXT,
      tailoredResumePdfPath TEXT,
      coverLetterPath TEXT,
      coverLetterPdfPath TEXT,
      screenshotPath TEXT,
      outreachDraftPath TEXT,
      masterResumeSnapshot TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(source, url)
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batchId TEXT NOT NULL,
      type TEXT NOT NULL,
      aiProvider TEXT NOT NULL,
      profileId TEXT NOT NULL,
      status TEXT NOT NULL,
      submittedAt TEXT NOT NULL,
      completedAt TEXT
    );
  `);
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

/**
 * Inserts a new company, or returns the existing one if a company with the
 * same name already exists (case-insensitive match).
 *
 * @returns The company's id (existing or newly created).
 */
export async function upsertCompany(
  company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const database = getDb();

  const existing = await database
    .select({ id: companies.id })
    .from(companies)
    .where(sql`LOWER(${companies.name}) = LOWER(${company.name})`)
    .limit(1);

  if (existing.length > 0) return existing[0]!.id;

  const id = randomUUID();
  const now = new Date().toISOString();
  await database.insert(companies).values({ id, ...company, createdAt: now, updatedAt: now });
  return id;
}

/**
 * Looks up a company by id.
 * @returns The Company, or null if not found.
 */
export async function getCompany(id: string): Promise<Company | null> {
  const rows = await getDb().select().from(companies).where(eq(companies.id, id)).limit(1);
  return (rows[0] as Company | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/**
 * Saves a new job to the database.
 * Automatically assigns a uuid, createdAt, and updatedAt.
 *
 * @param job - All Job fields except id, createdAt, updatedAt.
 * @returns The new job's id.
 */
export async function saveJob(
  job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await getDb().insert(jobs).values({ id, ...job, createdAt: now, updatedAt: now });
  return id;
}

/**
 * Saves multiple jobs in a single transaction.
 * Skips duplicates: if a job with the same (source, url) already exists, it is ignored.
 *
 * @returns Number of jobs actually inserted (duplicates excluded).
 */
export async function saveJobs(
  jobList: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<number> {
  if (jobList.length === 0) return 0;
  const now = new Date().toISOString();
  const rows = jobList.map(job => ({ id: randomUUID(), ...job, createdAt: now, updatedAt: now }));
  const result = await getDb()
    .insert(jobs)
    .values(rows)
    .onConflictDoNothing();
  return result.changes ?? 0;
}

/**
 * Fetches a single job by id.
 * @returns The Job, or null if not found.
 */
export async function getJob(id: string): Promise<Job | null> {
  const rows = await getDb().select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return (rows[0] as Job | undefined) ?? null;
}

/**
 * Queries jobs with optional filters. Returns all jobs if no filters are set.
 *
 * @param query - Filters: status, companyIds, minScore, since, source, limit, offset.
 * @returns Matching jobs ordered by createdAt DESC.
 */
export async function getJobs(query: JobQuery): Promise<Job[]> {
  let q = getDb().select().from(jobs).$dynamic();

  if (query.status !== undefined) {
    const statuses = Array.isArray(query.status) ? query.status : [query.status];
    q = q.where(inArray(jobs.status, statuses));
  }
  if (query.companyIds !== undefined && query.companyIds.length > 0) {
    q = q.where(inArray(jobs.companyId, query.companyIds));
  }
  if (query.minScore !== undefined) {
    q = q.where(gte(jobs.score, query.minScore));
  }
  if (query.since !== undefined) {
    q = q.where(gte(jobs.createdAt, query.since));
  }
  if (query.source !== undefined) {
    q = q.where(eq(jobs.source, query.source));
  }

  q = q.orderBy(sql`${jobs.createdAt} DESC`);
  if (query.limit !== undefined) q = q.limit(query.limit);
  if (query.offset !== undefined) q = q.offset(query.offset);

  return q as unknown as Promise<Job[]>;
}

/**
 * Updates specific fields on a job. Only the provided fields are changed.
 * Always updates updatedAt to now.
 *
 * @throws If no job with the given id exists.
 */
export async function updateJob(id: string, update: JobUpdate): Promise<void> {
  const result = await getDb()
    .update(jobs)
    .set({ ...update, updatedAt: new Date().toISOString() })
    .where(eq(jobs.id, id));
  if (result.changes === 0) throw new Error(`Job not found: ${id}`);
}

/**
 * Updates multiple jobs in a single transaction.
 */
export async function updateJobs(ids: string[], update: JobUpdate): Promise<void> {
  if (ids.length === 0) return;
  await getDb()
    .update(jobs)
    .set({ ...update, updatedAt: new Date().toISOString() })
    .where(inArray(jobs.id, ids));
}

// ---------------------------------------------------------------------------
// Counts & aggregates
// ---------------------------------------------------------------------------

/**
 * Counts jobs grouped by status.
 * @returns A record mapping each JobStatus to its count (0 if none).
 */
export async function countByStatus(): Promise<Record<JobStatus, number>> {
  const allStatuses: JobStatus[] = [
    'new', 'reviewed', 'ignored', 'filtered', 'applied', 'interview', 'offer', 'rejected',
  ];
  const result = Object.fromEntries(allStatuses.map(s => [s, 0])) as Record<JobStatus, number>;

  const rows = await getDb()
    .select({ status: jobs.status, count: sql<number>`COUNT(*)` })
    .from(jobs)
    .groupBy(jobs.status);

  for (const row of rows) {
    result[row.status as JobStatus] = row.count;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

/** Represents one AI batch job tracked in the batches table. */
export interface BatchRecord {
  id: string;
  batchId: string;
  type: string;
  aiProvider: string;
  profileId: string;
  status: 'pending' | 'completed' | 'failed' | 'partial_failed';
  submittedAt: string;
  completedAt: string | null;
}

/**
 * Records a newly submitted AI batch job.
 * @returns The local batch record id.
 */
export async function saveBatch(
  batchId: string,
  type: string,
  aiProvider: string,
  profileId: string
): Promise<string> {
  const id = randomUUID();
  await getDb().insert(batches).values({
    id, batchId, type, aiProvider, profileId,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    completedAt: null,
  });
  return id;
}

/**
 * Returns all batches with status 'pending'.
 */
export async function getPendingBatches(): Promise<BatchRecord[]> {
  return getDb()
    .select()
    .from(batches)
    .where(eq(batches.status, 'pending'))
    .orderBy(batches.submittedAt) as unknown as Promise<BatchRecord[]>;
}

/**
 * Marks a batch as completed or failed.
 */
export async function updateBatchStatus(
  id: string,
  status: 'completed' | 'failed' | 'partial_failed'
): Promise<void> {
  await getDb()
    .update(batches)
    .set({ status, completedAt: new Date().toISOString() })
    .where(eq(batches.id, id));
}
