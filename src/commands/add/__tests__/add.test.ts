/**
 * Tests for commands/add/index.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type * as DbModule from '../../../utils/db.js';

// Intercept initDb so add() uses :memory: instead of needing wolf.toml on disk.
// All other db functions (upsertCompany, saveJob, getJob, getCompany) remain real.
vi.mock('../../../utils/db.js', async () => {
  const actual = await vi.importActual<typeof DbModule>('../../../utils/db.js');
  return {
    ...actual,
    initDb: async () => actual.initDb(':memory:'),
  };
});

// Import after mock is registered
const { add } = await import('../index.js');
const { initDb, getJob, getCompany } = await import('../../../utils/db.js');

beforeEach(async () => {
  await initDb(':memory:');
});

const baseOptions = () => ({
  title: 'Software Engineer',
  company: 'Acme Corp',
  jdText: 'Full JD text here.',
  location: 'New York, NY',
  remote: false,
});

describe('add', () => {
  it('saves the job to DB and returns a jobId', async () => {
    const result = await add(baseOptions());
    expect(typeof result.jobId).toBe('string');
    expect(result.jobId.length).toBeGreaterThan(0);
  });

  it('saves the job with status new and score null', async () => {
    const { jobId } = await add(baseOptions());
    const job = await getJob(jobId);
    expect(job?.status).toBe('new');
    expect(job?.score).toBeNull();
  });

  it('uses source "manual" to identify AI-submitted jobs', async () => {
    const { jobId } = await add(baseOptions());
    const job = await getJob(jobId);
    expect(job?.source).toBe('manual');
  });

  it('stores the url when provided', async () => {
    const { jobId } = await add({ ...baseOptions(), url: 'https://example.com/job/1' });
    const job = await getJob(jobId);
    expect(job?.url).toBe('https://example.com/job/1');
  });

  it('uses empty string for url when not provided', async () => {
    const { jobId } = await add(baseOptions());
    const job = await getJob(jobId);
    expect(job?.url).toBe('');
  });

  it('upserts the company and sets companyId on the job', async () => {
    const { jobId } = await add(baseOptions());
    const job = await getJob(jobId);
    expect(typeof job?.companyId).toBe('string');
    const company = await getCompany(job!.companyId);
    expect(company?.name).toBe('Acme Corp');
  });
});
