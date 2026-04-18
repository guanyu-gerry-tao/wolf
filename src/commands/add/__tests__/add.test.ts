import { describe, it, expect, vi, beforeEach } from 'vitest';
import { add } from '../index.js';
import type { AppContext } from '../../../cli/appContext.js';
import type { Company } from '../../../types/company.js';

// Build a fake AppContext where every repository/service method is a vi.fn() spy.
// Default: companyRepository.getByName returns null (simulates company-not-found).
// Pass overrides to swap specific repos for different test scenarios.
function makeCtx(overrides: Partial<AppContext> = {}): AppContext {
  return {
    jobRepository: { save: vi.fn(), saveMany: vi.fn(), get: vi.fn(), query: vi.fn(), update: vi.fn(), updateMany: vi.fn(), countByStatus: vi.fn(), delete: vi.fn(), getWorkspaceDir: vi.fn(), readJdText: vi.fn(), writeJdText: vi.fn() },
    companyRepository: { get: vi.fn(), getByName: vi.fn().mockResolvedValue(null), upsert: vi.fn(), update: vi.fn(), query: vi.fn(), getWorkspaceDir: vi.fn(), readInfo: vi.fn() },
    batchRepository: { save: vi.fn(), getPending: vi.fn(), markComplete: vi.fn(), markFailed: vi.fn() },
    profileRepository: { get: vi.fn(), getDefault: vi.fn(), list: vi.fn(), getResumePool: vi.fn() },
    batchService: { submit: vi.fn(), pollAll: vi.fn() },
    jobProviders: [],
    ...overrides,
  } as unknown as AppContext;
}

// Tests for the add() command — the MCP-only entry point that saves a
// structured job (extracted by an AI caller) into the database.
// add() is responsible for: company upsert-or-reuse, job creation, and
// returning a jobId that downstream commands (wolf_score, wolf_tailor) chain on.
describe('add()', () => {
  beforeEach(() => vi.clearAllMocks());

  // Happy path: company does not exist yet.
  // add() should create the company via upsert, then save the job.
  // The returned jobId must be a valid UUID string so callers can chain it.
  it('saves a new company and job, returns jobId', async () => {
    // getByName returns null → company does not exist in DB
    const ctx = makeCtx();
    const result = await add({ title: 'SWE', company: 'Acme', jdText: 'Build things.' }, ctx);

    // Must return a usable jobId (UUID string)
    expect(result.jobId).toBeTypeOf('string');

    // Company didn't exist → upsert must be called to create it
    expect(ctx.companyRepository.upsert).toHaveBeenCalledOnce();

    // Job must be persisted exactly once
    expect(ctx.jobRepository.save).toHaveBeenCalledOnce();

    // Verify the saved job carries the correct fields from the input,
    // starts with status 'new', and has no score yet (scoring is a separate step)
    const savedJob = vi.mocked(ctx.jobRepository.save).mock.calls[0][0];
    expect(savedJob.title).toBe('SWE');
    expect(savedJob.status).toBe('new');
    expect(savedJob.score).toBeNull();

    // JD text is persisted to disk (jd.md) via writeJdText, not in the Job row.
    expect(ctx.jobRepository.writeJdText).toHaveBeenCalledWith(savedJob.id, 'Build things.');
  });

  // When the company already exists in the database, add() should reuse it
  // instead of creating a duplicate. The job's companyId should point to the
  // existing company row, not a freshly generated UUID.
  it('reuses existing company without calling upsert', async () => {
    const existingCompany: Company = {
      id: 'existing-id', name: 'Acme', domain: null, linkedinUrl: null,
      size: null, industry: null, headquartersLocation: null, notes: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };

    // getByName returns an existing company → company already in DB
    const ctx = makeCtx({
      companyRepository: { get: vi.fn(), getByName: vi.fn().mockResolvedValue(existingCompany), upsert: vi.fn(), update: vi.fn(), query: vi.fn(), getWorkspaceDir: vi.fn(), readInfo: vi.fn() },
    } as unknown as Partial<AppContext>);

    await add({ title: 'SWE', company: 'Acme', jdText: 'Build things.' }, ctx);

    // Company exists → upsert must NOT be called
    expect(ctx.companyRepository.upsert).not.toHaveBeenCalled();

    // The job's companyId must reference the existing company, not a new one
    const savedJob = vi.mocked(ctx.jobRepository.save).mock.calls[0][0];
    expect(savedJob.companyId).toBe('existing-id');
  });

  // url is an optional field in AddOptions. When provided, it should be
  // stored in the job record so wolf_tailor / wolf_fill can link back to
  // the original posting.
  it('sets url when provided', async () => {
    const ctx = makeCtx();
    await add({ title: 'SWE', company: 'Acme', jdText: 'Build things.', url: 'https://acme.com/jobs/1' }, ctx);
    const savedJob = vi.mocked(ctx.jobRepository.save).mock.calls[0][0];
    expect(savedJob.url).toBe('https://acme.com/jobs/1');
  });
});
