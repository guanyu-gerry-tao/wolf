import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobApplicationServiceImpl } from '../../../application/impl/jobApplicationServiceImpl.js';
import type { Job } from '../../../utils/types/job.js';
import type { Company } from '../../../utils/types/company.js';
import type { JobRepository } from '../../../repository/jobRepository.js';
import type { CompanyRepository } from '../../../repository/companyRepository.js';

// `wolf job show / get / set / fields` form the symmetric counterpart to
// `wolf profile`. Tests here pin the application-service contract:
// coercion + validation + read-back. CLI wrappers are thin and don't
// need their own tests beyond commander wiring.

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    title: 'SWE',
    companyId: 'company-1',
    url: 'https://example.com',
    source: 'Other',
    location: 'Remote',
    remote: true,
    salaryLow: null,
    salaryHigh: null,
    workAuthorizationRequired: 'no sponsorship',
    clearanceRequired: false,
    score: null,
    scoreJustification: null,
    status: 'new',
    error: null,
    appliedProfileId: null,
    hasTailoredResume: false,
    hasTailoredCoverLetter: false,
    hasScreenshots: false,
    hasOutreachDraft: false,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...overrides,
  };
}

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-1',
    name: 'Acme',
    domain: null,
    linkedinUrl: null,
    size: null,
    industry: null,
    headquartersLocation: null,
    notes: null,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...overrides,
  };
}

/** Builds a stub repo pair backed by an in-memory map. The save method
 *  replaces by id (mimicking SQLite INSERT OR REPLACE). */
function makeRepos(initial: Job[]): {
  jobRepo: JobRepository;
  companyRepo: CompanyRepository;
  jdStore: Map<string, string>;
} {
  const store = new Map<string, Job>(initial.map((j) => [j.id, j]));
  const jdStore = new Map<string, string>();

  const jobRepo: JobRepository = {
    get: vi.fn(async (id: string) => store.get(id) ?? null),
    save: vi.fn(async (job: Job) => {
      store.set(job.id, job);
    }),
    saveMany: vi.fn(),
    query: vi.fn(),
    // Mirror the real SQLite update: shallow-merge patch into the row,
    // touch updatedAt. Required for setField's repo.update() path.
    update: vi.fn(async (id: string, patch) => {
      const cur = store.get(id);
      if (!cur) return;
      store.set(id, { ...cur, ...patch, updatedAt: new Date().toISOString() } as Job);
    }),
    updateMany: vi.fn(),
    countByStatus: vi.fn(),
    countAll: vi.fn(),
    countWithTailoredResume: vi.fn(),
    countMatching: vi.fn(),
    delete: vi.fn(),
    getWorkspaceDir: vi.fn(),
    readJdText: vi.fn(async (id: string) => jdStore.get(id) ?? ''),
    writeJdText: vi.fn(async (id: string, txt: string) => {
      jdStore.set(id, txt);
    }),
    getArtifactPath: vi.fn(async (id: string, kind: string) => `/tmp/${id}/${kind}`),
  };
  const companyRepo: CompanyRepository = {
    get: vi.fn(async (id: string) => (id === 'company-1' ? makeCompany() : null)),
  } as unknown as CompanyRepository;

  return { jobRepo, companyRepo, jdStore };
}

describe('JobApplicationService.show', () => {
  // show() should return every flat column plus the JD prose and a
  // resolved company name. Used by `wolf job show <id>`.
  it('returns full job fields, description_md, and resolved company name', async () => {
    const { jobRepo, companyRepo, jdStore } = makeRepos([makeJob()]);
    jdStore.set('job-1', '# JD\nFull JD text here.');
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);

    const result = await svc.show('job-1');
    expect(result.companyName).toBe('Acme');
    expect(result.descriptionMd).toContain('JD text');
    expect(result.fields.title).toBe('SWE');
    expect(result.fields.status).toBe('new');
    // System-managed fields are present in show output.
    expect(result.fields.id).toBe('job-1');
    expect(result.fields.createdAt).toBeDefined();
  });

  // Missing job → throws with a helpful message rather than returning
  // partial / undefined fields.
  it('throws when the id does not exist', async () => {
    const { jobRepo, companyRepo } = makeRepos([]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    await expect(svc.show('missing')).rejects.toThrow(/Job not found: missing/);
  });
});

describe('JobApplicationService.getField', () => {
  // Reading a known scalar field returns the value as a printable string.
  it('reads a scalar field as a string', async () => {
    const { jobRepo, companyRepo } = makeRepos([makeJob({ score: 0.42 })]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    expect(await svc.getField('job-1', 'score')).toBe('0.42');
    expect(await svc.getField('job-1', 'remote')).toBe('true');
    expect(await svc.getField('job-1', 'status')).toBe('new');
  });

  // description_md is special — comes from a separate repo method, not
  // from the Job interface.
  it('reads description_md from JdText storage', async () => {
    const { jobRepo, companyRepo, jdStore } = makeRepos([makeJob()]);
    jdStore.set('job-1', 'JD prose');
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    expect(await svc.getField('job-1', 'description_md')).toBe('JD prose');
  });

  // Reading null returns ''. CLI consumers can distinguish via emptiness.
  it('returns empty string for null fields', async () => {
    const { jobRepo, companyRepo } = makeRepos([makeJob({ score: null })]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    expect(await svc.getField('job-1', 'score')).toBe('');
  });

  // Unknown field name is rejected at the application boundary.
  it('rejects unknown field names', async () => {
    const { jobRepo, companyRepo } = makeRepos([makeJob()]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    await expect(svc.getField('job-1', 'nonsense')).rejects.toThrow(/Unknown job field/);
  });
});

describe('JobApplicationService.setField', () => {
  // Successful set persists via repo.update (single-column UPDATE) and
  // returns before/after for CLI confirmation output. We assert on update,
  // NOT save — save would rewrite every column (concurrency-unsafe).
  it('coerces and persists a string field via repo.update', async () => {
    const { jobRepo, companyRepo } = makeRepos([makeJob({ title: 'old' })]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    const r = await svc.setField('job-1', 'title', 'Senior SWE');
    expect(r.field).toBe('title');
    expect(r.oldValue).toBe('old');
    expect(r.newValue).toBe('Senior SWE');
    // The patch handed to update() is exactly { title: 'Senior SWE' } —
    // no other columns are touched.
    expect(jobRepo.update).toHaveBeenCalledWith('job-1', { title: 'Senior SWE' });
    // save() must NOT be called for setField — that's the old INSERT-OR-REPLACE
    // path which we deliberately moved away from.
    expect(jobRepo.save).not.toHaveBeenCalled();
  });

  // Booleans accept multiple input shapes — yes/no, true/false, 1/0.
  it('coerces boolean inputs from yes/no/true/false/1/0', async () => {
    const { jobRepo, companyRepo } = makeRepos([makeJob({ remote: false })]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    await svc.setField('job-1', 'remote', 'yes');
    expect(jobRepo.update).toHaveBeenLastCalledWith('job-1', { remote: true });
    await svc.setField('job-1', 'remote', '0');
    expect(jobRepo.update).toHaveBeenLastCalledWith('job-1', { remote: false });
  });

  // Enum coercion rejects values outside the allowed set.
  it('rejects bad enum values for status', async () => {
    const { jobRepo, companyRepo } = makeRepos([makeJob()]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    await expect(svc.setField('job-1', 'status', 'bogus')).rejects.toThrow(/must be one of/);
  });

  // Numbers reject non-numeric input.
  it('rejects non-numeric input for score', async () => {
    const { jobRepo, companyRepo } = makeRepos([makeJob()]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    await expect(svc.setField('job-1', 'score', 'high')).rejects.toThrow(/must be a number/);
  });

  // Empty input on optional number clears (sets null). The patch must
  // explicitly carry `score: null` so SQL writes NULL, not "skip column".
  it('clears optional number fields on empty input', async () => {
    const { jobRepo, companyRepo } = makeRepos([makeJob({ score: 0.7 })]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    const r = await svc.setField('job-1', 'score', '');
    expect(r.newValue).toBe('');
    expect(jobRepo.update).toHaveBeenCalledWith('job-1', { score: null });
  });

  // System-managed fields (id, createdAt) are protected from writes.
  it('refuses to set system-managed fields', async () => {
    const { jobRepo, companyRepo } = makeRepos([makeJob()]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    await expect(svc.setField('job-1', 'createdAt', '2026-04-19')).rejects.toThrow(/system-managed/);
    await expect(svc.setField('job-1', 'id', 'new-id')).rejects.toThrow(/system-managed/);
  });

  // description_md goes to writeJdText, not update — it lives in a SQLite
  // column accessed via a dedicated repo method, not on the Job interface.
  it('routes description_md writes to writeJdText', async () => {
    const { jobRepo, companyRepo } = makeRepos([makeJob()]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    await svc.setField('job-1', 'description_md', '# New JD\nbody');
    expect(jobRepo.writeJdText).toHaveBeenCalledWith('job-1', '# New JD\nbody');
    // Neither update() nor save() should fire for description_md.
    expect(jobRepo.update).not.toHaveBeenCalled();
    expect(jobRepo.save).not.toHaveBeenCalled();
  });
});

describe('JobApplicationService.fields', () => {
  // No filter → returns the full JOB_FIELDS list.
  it('lists every editable field by default', async () => {
    const { jobRepo, companyRepo } = makeRepos([]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    const all = svc.fields();
    // Sanity-check well-known names exist.
    expect(all.find((f) => f.name === 'title')).toBeDefined();
    expect(all.find((f) => f.name === 'status')).toBeDefined();
    expect(all.find((f) => f.name === 'description_md')).toBeDefined();
    // System-managed fields are NOT enumerated.
    expect(all.find((f) => f.name === 'id')).toBeUndefined();
    expect(all.find((f) => f.name === 'createdAt')).toBeUndefined();
  });

  // requiredOnly filters to required fields.
  it('filters to required fields when requested', async () => {
    const { jobRepo, companyRepo } = makeRepos([]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    const required = svc.fields({ requiredOnly: true });
    expect(required.every((f) => f.required)).toBe(true);
    expect(required.find((f) => f.name === 'title')).toBeDefined(); // required
    expect(required.find((f) => f.name === 'score')).toBeUndefined(); // optional
  });

  // Looking up by name returns just that field (or empty if missing).
  it('returns a single field when name is given', async () => {
    const { jobRepo, companyRepo } = makeRepos([]);
    const svc = new JobApplicationServiceImpl(jobRepo, companyRepo);
    expect(svc.fields({ name: 'status' })).toHaveLength(1);
    expect(svc.fields({ name: 'status' })[0].enumValues).toBeDefined();
    expect(svc.fields({ name: 'nonsense' })).toEqual([]);
  });
});

// Mostly here to silence "vitest expects at least one assertion" lint
// when the file is otherwise stable.
beforeEach(() => {});
afterEach(() => {});
