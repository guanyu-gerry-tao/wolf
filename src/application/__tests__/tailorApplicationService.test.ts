import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TailorApplicationServiceImpl } from '../impl/tailorApplicationServiceImpl.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type { RenderService } from '../../service/renderService.js';
import type { ResumeCoverLetterService } from '../../service/resumeCoverLetterService.js';
import type { AiConfig } from '../../types/index.js';
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
  coverLetterHtmlPath: null,
  coverLetterPdfPath: null,
  screenshotPath: null,
  outreachDraftPath: null,
  createdAt: '2026-04-12T00:00:00.000Z',
  updatedAt: '2026-04-12T00:00:00.000Z',
};

const FAKE_PROFILE: UserProfile = {
  id: 'default', label: 'Default', name: 'Alex', email: 'alex@example.com',
  phone: '+1 555 000 0000', firstUrl: null, secondUrl: null, thirdUrl: null,
  immigrationStatus: 'no limit', willingToRelocate: 'no',
  targetRoles: ['SWE'], targetLocations: ['Remote'], scoringNotes: null,
};

// Default AI config used across tests — matches production default.
const DEFAULT_AI: AiConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };

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
  return {
    renderPdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
    renderCoverLetterPdf: vi.fn().mockResolvedValue(Buffer.from('fake-cl-pdf')),
  };
}

function makeRewriteSvc(): ResumeCoverLetterService {
  return {
    tailorResumeToHtml: vi.fn().mockResolvedValue('<h2>EXPERIENCE</h2>'),
    generateCoverLetter: vi.fn().mockResolvedValue('<p>Dear Hiring Manager...</p>'),
  };
}

describe('TailorApplicationService', () => {
  beforeEach(() => vi.clearAllMocks());

  // Happy path: successful tailor writes PDF and updates job record.
  it('returns pdf path and updates job record on success', async () => {
    const jobRepo = makeJobRepo();
    const svc = new TailorApplicationServiceImpl(
      jobRepo, makeProfileRepo(), makeRenderSvc(), makeRewriteSvc(),
      '/workspace', DEFAULT_AI, 'professional',
    );
    const result = await svc.tailor({ jobId: 'job-1' });
    expect(result.tailoredPdfPath).toContain('resume.pdf');
    expect(jobRepo.update).toHaveBeenCalledWith('job-1', expect.objectContaining({
      tailoredResumePdfPath: expect.any(String),
    }));
  });

  // Job not found: should throw clearly so CLI/MCP can surface a useful error.
  it('throws if job is not found', async () => {
    const svc = new TailorApplicationServiceImpl(
      makeJobRepo(null), makeProfileRepo(), makeRenderSvc(), makeRewriteSvc(),
      '/workspace', DEFAULT_AI, 'professional',
    );
    await expect(svc.tailor({ jobId: 'missing-job' })).rejects.toThrow('Job not found');
  });

  // Verify the correct inputs are passed down to ResumeCoverLetterService.
  it('calls rewriteService with resume pool, JD text, profile, and aiConfig', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = new TailorApplicationServiceImpl(
      makeJobRepo(), makeProfileRepo(), makeRenderSvc(), rewriteSvc,
      '/workspace', DEFAULT_AI, 'professional',
    );
    await svc.tailor({ jobId: 'job-1' });
    expect(rewriteSvc.tailorResumeToHtml).toHaveBeenCalledWith(
      '# EXPERIENCE\nBuilt things.',
      'Build cool stuff with Go.',
      FAKE_PROFILE,
      DEFAULT_AI,
    );
  });

  // Verify that aiModel override in TailorOptions replaces the default AI config.
  // The override arrives as a "<provider>/<model>" string and gets parsed into AiConfig.
  it('passes overridden aiConfig when TailorOptions specifies aiModel', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = new TailorApplicationServiceImpl(
      makeJobRepo(), makeProfileRepo(), makeRenderSvc(), rewriteSvc,
      '/workspace', DEFAULT_AI, 'professional',
    );
    await svc.tailor({ jobId: 'job-1', aiModel: 'openai/gpt-4o' });
    const calledWithAiConfig = vi.mocked(rewriteSvc.tailorResumeToHtml).mock.calls[0][3];
    expect(calledWithAiConfig).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  // Verify that when no override is given, defaultAiConfig is used unchanged.
  it('uses defaultAiConfig when TailorOptions has no aiModel', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = new TailorApplicationServiceImpl(
      makeJobRepo(), makeProfileRepo(), makeRenderSvc(), rewriteSvc,
      '/workspace', DEFAULT_AI, 'professional',
    );
    await svc.tailor({ jobId: 'job-1' });
    const calledWithAiConfig = vi.mocked(rewriteSvc.tailorResumeToHtml).mock.calls[0][3];
    expect(calledWithAiConfig).toEqual(DEFAULT_AI);
  });

  // Cover letter default: when coverLetter option is not set, generateCoverLetter is called and paths are returned.
  it('calls generateCoverLetter and returns coverLetterHtmlPath when coverLetter is not false', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = new TailorApplicationServiceImpl(
      makeJobRepo(), makeProfileRepo(), makeRenderSvc(), rewriteSvc,
      '/workspace', DEFAULT_AI, 'professional',
    );
    const result = await svc.tailor({ jobId: 'job-1' });
    expect(rewriteSvc.generateCoverLetter).toHaveBeenCalledOnce();
    expect(rewriteSvc.generateCoverLetter).toHaveBeenCalledWith(
      expect.any(String),  // resumePool
      expect.any(String),  // jdText
      FAKE_PROFILE,
      'professional',      // tone
      DEFAULT_AI,          // aiConfig
    );
    expect(result.coverLetterHtmlPath).toContain('cover_letter.html');
    expect(result.coverLetterPdfPath).toContain('cover_letter.pdf');
  });

  // Cover letter opt-out: when coverLetter: false, generation is skipped entirely.
  it('skips cover letter generation when coverLetter is false', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = new TailorApplicationServiceImpl(
      makeJobRepo(), makeProfileRepo(), makeRenderSvc(), rewriteSvc,
      '/workspace', DEFAULT_AI, 'professional',
    );
    const result = await svc.tailor({ jobId: 'job-1', coverLetter: false });
    expect(rewriteSvc.generateCoverLetter).not.toHaveBeenCalled();
    expect(result.coverLetterHtmlPath).toBeNull();
    expect(result.coverLetterPdfPath).toBeNull();
  });
});
