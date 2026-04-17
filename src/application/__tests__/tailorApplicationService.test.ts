import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TailorApplicationServiceImpl } from '../impl/tailorApplicationServiceImpl.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type { RenderService } from '../../service/renderService.js';
import type { ResumeCoverLetterService } from '../../service/resumeCoverLetterService.js';
import type { TailoringBriefService } from '../../service/tailoringBriefService.js';
import type { AiConfig } from '../../types/index.js';
import type { Job } from '../../types/job.js';
import type { UserProfile } from '../../types/index.js';

// Mock fs/promises so no real files are written during tests.
// readFile returns path-dependent content so hint.md vs brief.md lookups stay distinct.
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockImplementation((p: string) => {
    if (p.endsWith('hint.md')) return Promise.resolve('// comment-only template\n');
    return Promise.resolve('# mock brief');
  }),
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
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

const DEFAULT_AI: AiConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };
const FAKE_BRIEF = '# Tailoring Brief\n## Selected Roles\nSWE at Example Corp';

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

function makeBriefSvc(): TailoringBriefService {
  return {
    analyze: vi.fn().mockResolvedValue(FAKE_BRIEF),
  };
}

function makeSvc(overrides: {
  jobRepo?: JobRepository;
  rewriteSvc?: ResumeCoverLetterService;
  briefSvc?: TailoringBriefService;
} = {}) {
  return new TailorApplicationServiceImpl(
    overrides.jobRepo ?? makeJobRepo(),
    makeProfileRepo(),
    makeRenderSvc(),
    overrides.rewriteSvc ?? makeRewriteSvc(),
    overrides.briefSvc ?? makeBriefSvc(),
    '/workspace',
    DEFAULT_AI,
    'professional',
  );
}

describe('TailorApplicationService', () => {
  beforeEach(() => vi.clearAllMocks());

  // Full pipeline: analyst brief -> resume + CL in parallel.
  it('returns pdf path and updates job record on success', async () => {
    const jobRepo = makeJobRepo();
    const svc = makeSvc({ jobRepo });
    const result = await svc.tailor({ jobId: 'job-1' });
    expect(result.tailoredPdfPath).toContain('resume.pdf');
    expect(jobRepo.update).toHaveBeenCalledWith('job-1', expect.objectContaining({
      tailoredResumePdfPath: expect.any(String),
    }));
  });

  // Analyst runs first so both writers see the same brief.
  it('calls briefService.analyze before rewrite methods', async () => {
    const briefSvc = makeBriefSvc();
    const rewriteSvc = makeRewriteSvc();
    const svc = makeSvc({ briefSvc, rewriteSvc });
    await svc.tailor({ jobId: 'job-1' });
    expect(briefSvc.analyze).toHaveBeenCalledOnce();
    // Both writers should receive the brief text.
    expect(rewriteSvc.tailorResumeToHtml).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      FAKE_PROFILE,
      FAKE_BRIEF,
      DEFAULT_AI,
    );
    expect(rewriteSvc.generateCoverLetter).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      FAKE_PROFILE,
      FAKE_BRIEF,
      'professional',
      DEFAULT_AI,
    );
  });

  it('throws if job is not found', async () => {
    const svc = makeSvc({ jobRepo: makeJobRepo(null) });
    await expect(svc.tailor({ jobId: 'missing-job' })).rejects.toThrow('Job not found');
  });

  // aiModel override: "<provider>/<model>" string overrides the default.
  it('passes overridden aiConfig when TailorOptions specifies aiModel', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = makeSvc({ rewriteSvc });
    await svc.tailor({ jobId: 'job-1', aiModel: 'openai/gpt-4o' });
    const calledWithAiConfig = vi.mocked(rewriteSvc.tailorResumeToHtml).mock.calls[0][4];
    expect(calledWithAiConfig).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('uses defaultAiConfig when TailorOptions has no aiModel', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = makeSvc({ rewriteSvc });
    await svc.tailor({ jobId: 'job-1' });
    const calledWithAiConfig = vi.mocked(rewriteSvc.tailorResumeToHtml).mock.calls[0][4];
    expect(calledWithAiConfig).toEqual(DEFAULT_AI);
  });

  // Cover letter included by default; parallel with resume.
  it('generates cover letter by default', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = makeSvc({ rewriteSvc });
    const result = await svc.tailor({ jobId: 'job-1' });
    expect(rewriteSvc.generateCoverLetter).toHaveBeenCalledOnce();
    expect(result.coverLetterHtmlPath).toContain('cover_letter.html');
    expect(result.coverLetterPdfPath).toContain('cover_letter.pdf');
  });

  it('skips cover letter when coverLetter is false', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = makeSvc({ rewriteSvc });
    const result = await svc.tailor({ jobId: 'job-1', coverLetter: false });
    expect(rewriteSvc.generateCoverLetter).not.toHaveBeenCalled();
    expect(result.coverLetterHtmlPath).toBeNull();
    expect(result.coverLetterPdfPath).toBeNull();
  });

  // Standalone steps: analyze, writeResume, writeCoverLetter.
  it('analyze() produces only the brief', async () => {
    const briefSvc = makeBriefSvc();
    const rewriteSvc = makeRewriteSvc();
    const svc = makeSvc({ briefSvc, rewriteSvc });
    const result = await svc.analyze({ jobId: 'job-1' });
    expect(result.briefPath).toContain('tailoring-brief.md');
    expect(briefSvc.analyze).toHaveBeenCalledOnce();
    // Writers should NOT be called — analyze is step 1 only.
    expect(rewriteSvc.tailorResumeToHtml).not.toHaveBeenCalled();
    expect(rewriteSvc.generateCoverLetter).not.toHaveBeenCalled();
  });

  // writeResume reads the existing brief from disk (mocked via readFile).
  it('writeResume() reads brief from disk and writes resume', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = makeSvc({ rewriteSvc });
    const result = await svc.writeResume({ jobId: 'job-1' });
    expect(result.pdfPath).toContain('resume.pdf');
    expect(rewriteSvc.tailorResumeToHtml).toHaveBeenCalledOnce();
    expect(rewriteSvc.generateCoverLetter).not.toHaveBeenCalled();
  });

  // writeCoverLetter reads the existing brief from disk (mocked via readFile).
  it('writeCoverLetter() reads brief from disk and writes CL', async () => {
    const rewriteSvc = makeRewriteSvc();
    const svc = makeSvc({ rewriteSvc });
    const result = await svc.writeCoverLetter({ jobId: 'job-1' });
    expect(result.pdfPath).toContain('cover_letter.pdf');
    expect(rewriteSvc.generateCoverLetter).toHaveBeenCalledOnce();
    expect(rewriteSvc.tailorResumeToHtml).not.toHaveBeenCalled();
  });

  // Hint: when no hint parameter is given and hint.md has only comment lines,
  // the analyst is called with hint=undefined (stripComments leaves it empty).
  it('passes hint=undefined when hint.md only contains // comments', async () => {
    const briefSvc = makeBriefSvc();
    const svc = makeSvc({ briefSvc });
    await svc.analyze({ jobId: 'job-1' });
    const hintArg = vi.mocked(briefSvc.analyze).mock.calls[0][4];
    expect(hintArg).toBeUndefined();
  });

  // Hint: active hint content (after stripping //) is forwarded to the analyst.
  it('forwards active hint text to the analyst when hint.md has non-comment content', async () => {
    const { readFile } = await import('node:fs/promises');
    // Path-aware override: hint.md returns real content; brief.md stays as before.
    // Using `as never` keeps vitest's narrow signature happy without widening the mock.
    vi.mocked(readFile).mockImplementation(((p: string) =>
      p.endsWith('hint.md')
        ? Promise.resolve('// header\nfocus on distributed systems\n')
        : Promise.resolve('# mock brief')
    ) as never);
    const briefSvc = makeBriefSvc();
    const svc = makeSvc({ briefSvc });
    await svc.analyze({ jobId: 'job-1' });
    const hintArg = vi.mocked(briefSvc.analyze).mock.calls[0][4];
    expect(hintArg).toBe('focus on distributed systems');
  });

  // Hint: when options.hint is provided, it is written to hint.md (with the
  // self-documenting header) and then picked up by runAnalysis.
  it('writes hint.md with header + user content when options.hint is set', async () => {
    const { writeFile } = await import('node:fs/promises');
    const svc = makeSvc();
    await svc.analyze({ jobId: 'job-1', hint: 'focus on ML ops' });
    const hintWrite = vi.mocked(writeFile).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).endsWith('hint.md'),
    );
    expect(hintWrite).toBeDefined();
    expect(hintWrite![1]).toContain('hint.md - Pre-analysis guidance');
    expect(hintWrite![1]).toContain('focus on ML ops');
  });

  // Hint: passing --hint "" is the documented way to clear an existing hint.
  // The file is still overwritten (header only), so subsequent runs won't see
  // any leftover guidance.
  it('clears hint.md content when options.hint is the empty string', async () => {
    const { writeFile } = await import('node:fs/promises');
    const svc = makeSvc();
    await svc.analyze({ jobId: 'job-1', hint: '' });
    const hintWrite = vi.mocked(writeFile).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).endsWith('hint.md'),
    );
    expect(hintWrite).toBeDefined();
    const body = hintWrite![1] as string;
    expect(body).toContain('hint.md - Pre-analysis guidance');
    // Strip the header: everything after the last // line should be blank.
    const active = body
      .split('\n')
      .filter(l => !l.trimStart().startsWith('//'))
      .join('\n')
      .trim();
    expect(active).toBe('');
  });
});
