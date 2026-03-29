/**
 * Tests for utils/db.ts
 *
 * Each test gets a fresh in-memory SQLite database via initDb(':memory:').
 * No mocking needed — we test against a real DB.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initDb, upsertCompany, getCompany,
  saveJob, saveJobs, getJob, getJobs, updateJob,
  countByStatus, saveBatch, getPendingBatches, updateBatchStatus,
} from '../db.js';
import type { Job } from '../../types/index.js';

// Reset the module-level db singleton before each test via a fresh initDb call.
// Using a unique temp path per test suite run (in-memory doesn't persist between calls).
beforeEach(async () => {
  // Re-initialise with :memory: — each call creates a fresh in-memory database.
  await initDb(':memory:');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseJob = (): Omit<Job, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: 'Software Engineer',
  companyId: 'company-1',
  url: 'https://example.com/jobs/1',
  source: 'manual',
  description: 'Full JD text here.',
  location: 'New York, NY',
  remote: false,
  salary: 120000,
  workAuthorizationRequired: null,
  score: null,
  scoreJustification: null,
  status: 'new',
  appliedProfileId: null,
  tailoredResumePath: null,
  tailoredResumePdfPath: null,
  coverLetterPath: null,
  coverLetterPdfPath: null,
  screenshotPath: null,
  outreachDraftPath: null,
  masterResumeSnapshot: null,
});

// ---------------------------------------------------------------------------
// initDb
// ---------------------------------------------------------------------------

describe('initDb', () => {
  it('creates tables — jobs table is queryable after init', async () => {
    const jobs = await getJobs({});
    expect(jobs).toEqual([]);
  });

  it('is idempotent — calling twice does not throw', async () => {
    await expect(initDb(':memory:')).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// upsertCompany
// ---------------------------------------------------------------------------

describe('upsertCompany', () => {
  it('inserts a new company and returns its id', async () => {
    const id = await upsertCompany({ name: 'Google', domain: null, linkedinUrl: null, size: null, industry: null, headquartersLocation: null, notes: null });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns the same id for a duplicate company name (case-insensitive)', async () => {
    const id1 = await upsertCompany({ name: 'Google', domain: null, linkedinUrl: null, size: null, industry: null, headquartersLocation: null, notes: null });
    const id2 = await upsertCompany({ name: 'google', domain: null, linkedinUrl: null, size: null, industry: null, headquartersLocation: null, notes: null });
    expect(id1).toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// getCompany
// ---------------------------------------------------------------------------

describe('getCompany', () => {
  it('returns the company after insertion', async () => {
    const id = await upsertCompany({ name: 'Meta', domain: 'meta.com', linkedinUrl: null, size: null, industry: null, headquartersLocation: null, notes: null });
    const company = await getCompany(id);
    expect(company?.name).toBe('Meta');
    expect(company?.domain).toBe('meta.com');
  });

  it('returns null for unknown id', async () => {
    const result = await getCompany('nonexistent-id');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// saveJob
// ---------------------------------------------------------------------------

describe('saveJob', () => {
  it('saves a job and returns a non-empty id', async () => {
    const id = await saveJob(baseJob());
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('persists all fields correctly', async () => {
    const job = { ...baseJob(), title: 'Staff Engineer', remote: true, salary: 'unpaid' as const };
    const id = await saveJob(job);
    const saved = await getJob(id);
    expect(saved?.title).toBe('Staff Engineer');
    expect(saved?.remote).toBe(true);
    expect(saved?.salary).toBe('unpaid');
  });
});

// ---------------------------------------------------------------------------
// saveJobs (bulk)
// ---------------------------------------------------------------------------

describe('saveJobs (bulk)', () => {
  it('inserts multiple jobs and returns the inserted count', async () => {
    const jobs = [
      { ...baseJob(), url: 'https://example.com/1' },
      { ...baseJob(), url: 'https://example.com/2' },
    ];
    const count = await saveJobs(jobs);
    expect(count).toBe(2);
  });

  it('skips duplicates with the same (source, url)', async () => {
    const job = { ...baseJob(), url: 'https://example.com/dup' };
    await saveJob(job);
    const count = await saveJobs([job]);
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getJobs
// ---------------------------------------------------------------------------

describe('getJobs', () => {
  it('returns all jobs when no filters are set', async () => {
    await saveJob({ ...baseJob(), url: 'https://a.com' });
    await saveJob({ ...baseJob(), url: 'https://b.com' });
    const jobs = await getJobs({});
    expect(jobs.length).toBe(2);
  });

  it('filters by status', async () => {
    await saveJob({ ...baseJob(), url: 'https://a.com', status: 'new' });
    await saveJob({ ...baseJob(), url: 'https://b.com', status: 'applied' });
    const jobs = await getJobs({ status: 'new' });
    expect(jobs.length).toBe(1);
    expect(jobs[0]!.status).toBe('new');
  });

  it('filters by minScore', async () => {
    await saveJob({ ...baseJob(), url: 'https://a.com', score: 0.9 });
    await saveJob({ ...baseJob(), url: 'https://b.com', score: 0.3 });
    const jobs = await getJobs({ minScore: 0.5 });
    expect(jobs.length).toBe(1);
    expect(jobs[0]!.score).toBe(0.9);
  });
});

// ---------------------------------------------------------------------------
// updateJob
// ---------------------------------------------------------------------------

describe('updateJob', () => {
  it('updates specific fields without touching others', async () => {
    const id = await saveJob(baseJob());
    await updateJob(id, { status: 'applied', score: 0.85 });
    const updated = await getJob(id);
    expect(updated?.status).toBe('applied');
    expect(updated?.score).toBe(0.85);
    expect(updated?.title).toBe('Software Engineer'); // unchanged
  });

  it('throws if the job does not exist', async () => {
    await expect(updateJob('ghost-id', { status: 'applied' })).rejects.toThrow('ghost-id');
  });
});

// ---------------------------------------------------------------------------
// countByStatus
// ---------------------------------------------------------------------------

describe('countByStatus', () => {
  it('returns 0 for all statuses when DB is empty', async () => {
    const counts = await countByStatus();
    expect(counts.new).toBe(0);
    expect(counts.applied).toBe(0);
    expect(counts.rejected).toBe(0);
  });

  it('counts correctly after inserting jobs', async () => {
    await saveJob({ ...baseJob(), url: 'https://a.com', status: 'new' });
    await saveJob({ ...baseJob(), url: 'https://b.com', status: 'new' });
    await saveJob({ ...baseJob(), url: 'https://c.com', status: 'applied' });
    const counts = await countByStatus();
    expect(counts.new).toBe(2);
    expect(counts.applied).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// saveBatch / getPendingBatches / updateBatchStatus
// ---------------------------------------------------------------------------

describe('saveBatch / getPendingBatches / updateBatchStatus', () => {
  it('saves a batch and returns a local id', async () => {
    const id = await saveBatch('batch-abc', 'score', 'anthropic', 'default');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns the batch in getPendingBatches', async () => {
    await saveBatch('batch-abc', 'score', 'anthropic', 'default');
    const pending = await getPendingBatches();
    expect(pending.length).toBe(1);
    expect(pending[0]!.batchId).toBe('batch-abc');
    expect(pending[0]!.status).toBe('pending');
  });

  it('removes batch from pending after marking completed', async () => {
    const id = await saveBatch('batch-abc', 'score', 'anthropic', 'default');
    await updateBatchStatus(id, 'completed');
    const pending = await getPendingBatches();
    expect(pending.length).toBe(0);
  });
});
