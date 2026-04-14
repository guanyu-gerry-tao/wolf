import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TailorApplicationServiceImpl } from '../impl/tailorApplicationService.js';
import type { JobRepository } from '../../repository/job.js';
import type { ProfileRepository } from '../../repository/profile.js';
import type { RenderService } from '../../service/render.js';
import type { RewriteService } from '../../service/rewrite.js';
import type { Job } from '../../types/job.js';
import type { UserProfile } from '../../types/index.js';

// Mock fs/promises so no real files are written during tests.
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

const FAKE_JOB: Job = {
  id: 'job-1',
  title: 'SWE',
  companyId: 'company-1',
  url: 'https://example.com',
  source: 'Other',
  description: 'Build cool stuff with Go.',
  location: '',
  remote: false,
  salary: null,
  workAuthorizationRequired: 'no sponsorship',
  clearanceRequired: false,
  score: null,
  scoreJustification: null,
  status: 'new',
  error: null,
  appliedProfileId: null,
  tailoredResumeTexPath: null,
  tailoredResumePdfPath: null,
  coverLetterMDPath: null,
  coverLetterPdfPath: null,
  screenshotPath: null,
  outreachDraftPath: null,
  createdAt: '2026-04-12T00:00:00.000Z',
  updatedAt: '2026-04-12T00:00:00.000Z',
};

const FAKE_PROFILE: UserProfile = {
  id: 'default', label: 'Default', name: 'Alex', email: 'alex@example.com',
  phone: '+1 555 000 0000', firstUrl: null, secondUrl: null, thirdUrl: null,
  immigrationStatus: 'no limit', willingToRelocate: false,
  targetRoles: ['SWE'], targetLocations: ['Remote'], scoringNotes: null,
};

function makeJobRepo(job: Job | null = FAKE_JOB): JobRepository {
  return {
    get: vi.fn().mockResolvedValue(job),
    save: vi.fn(), saveMany: vi.fn(), query: vi.fn(), update: vi.fn(),
    updateMany: vi.fn(), countByStatus: vi.fn(), delete: vi.fn(),
  } as unknown as JobRepository;
}

function makeProfileRepo(): ProfileRepository {
  return {
    get: vi.fn(), getDefault: vi.fn().mockResolvedValue(FAKE_PROFILE),
    list: vi.fn(), getResumePool: vi.fn().mockResolvedValue('# EXPERIENCE\nBuilt things.'),
  } as unknown as ProfileRepository;
}

function makeRenderSvc(): RenderService {
  return { renderResumePdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')) };
}

function makeRewriteSvc(): RewriteService {
  return { tailorResumeToHtml: vi.fn().mockResolvedValue('<h2>EXPERIENCE</h2>') };
}

describe('TailorApplicationServiceImpl', () => {
  beforeEach(() => vi.clearAllMocks());

  // Happy path: successful tailor writes PDF and updates job record.
  it('returns pdf path and updates job record on success', async () => {
    const jobRepo = makeJobRepo();
    const svc = new TailorApplicationServiceImpl(
      jobRepo, makeProfileRepo(), makeRenderSvc(), makeRewriteSvc(),
      '/workspace',
    );
    const result = await svc.tailor('job-1');
    expect(result.tailoredPdfPath).toContain('resume.pdf');
    expect(jobRepo.update).toHaveBeenCalledWith('job-1', expect.objectContaining({
      tailoredResumePdfPath: expect.any(String),
    }));
  });

  // Job not found: should throw clearly so CLI/MCP can surface a useful error.
  it('throws if job is not found', async () => {
    const svc = new TailorApplicationServiceImpl(
      makeJobRepo(null), makeProfileRepo(), makeRenderSvc(), makeRewriteSvc(),
      '/workspace',
    );
    await expect(svc.tailor('missing-job')).rejects.toThrow('Job not found');
  });

  // Verify the correct inputs are passed down to RewriteService.
  it('calls rewriteService with resume pool and JD text', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = new TailorApplicationServiceImpl(
      makeJobRepo(), makeProfileRepo(), makeRenderSvc(), rewriteSvc,
      '/workspace',
    );
    await svc.tailor('job-1');
    expect(rewriteSvc.tailorResumeToHtml).toHaveBeenCalledWith(
      '# EXPERIENCE\nBuilt things.',
      'Build cool stuff with Go.',
      FAKE_PROFILE,
    );
  });
});
