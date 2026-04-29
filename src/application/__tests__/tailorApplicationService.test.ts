import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TailorApplicationServiceImpl } from '../impl/tailorApplicationServiceImpl.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type { RenderService } from '../../service/renderService.js';
import type { ResumeCoverLetterService } from '../../service/resumeCoverLetterService.js';
import type { TailoringBriefService } from '../../service/tailoringBriefService.js';
import type { AiConfig } from '../../utils/types/index.js';
import type { Job } from '../../utils/types/job.js';
import type { Profile } from '../../utils/types/index.js';

// Mock fs/promises so no real files are written during tests.
// readFile returns path-dependent content so hint.md vs brief.md lookups stay distinct.
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockImplementation((p: string) => {
    // Default hint.md content: only the GitHub-Alert header block, which
    // stripComments fully removes — so callers see the file as effectively empty.
    if (p.endsWith('hint.md')) return Promise.resolve('> [!TIP]\n> alert-only template\n');
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
  tailoredResumePdfPath: null,
  coverLetterHtmlPath: null,
  coverLetterPdfPath: null,
  screenshotPath: null,
  outreachDraftPath: null,
  createdAt: '2026-04-12T00:00:00.000Z',
  updatedAt: '2026-04-12T00:00:00.000Z',
};

// Profile is now `{ name, md }` — name is the directory name, md is the
// raw profile.md content. The md fixture must satisfy assertReadyForTailor's
// REQUIRED-fields check: # Identity > Legal first/last name + # Contact >
// Email/Phone all present with non-empty bodies.
const FAKE_PROFILE: Profile = {
  name: 'default',
  md: [
    '# default',
    '',
    '# Identity',
    '',
    '## Legal first name',
    'Alex',
    '',
    '## Legal last name',
    'Rivera',
    '',
    '# Contact',
    '',
    '## Email',
    'alex@example.test',
    '',
    '## Phone',
    '+1 555 010 0100',
    '',
  ].join('\n'),
};

// Resume pool fixture must clear MIN_POOL_CONTENT_LINES (5 substantive
// non-heading lines). Six bullets / dates clear it cleanly.
const FAKE_RESUME_POOL = [
  '# Resume Pool',
  '',
  '## Experience',
  '### SWE — Acme',
  '*2022 - 2025*',
  '- Built distributed systems handling 10k req/s.',
  '- Cut p99 latency 40% via Postgres tuning.',
  '- Owned the on-call rotation for the ingestion path.',
  '',
  '## Skills',
  'TypeScript, Go, PostgreSQL',
  '',
].join('\n');

const DEFAULT_AI: AiConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };
const FAKE_BRIEF = '# Tailoring Brief\n## Selected Roles\nSWE at Example Corp';

function makeJobRepo(job: Job | null = FAKE_JOB): JobRepository {
  return {
    get: vi.fn().mockResolvedValue(job),
    save: vi.fn(), saveMany: vi.fn(), query: vi.fn(), update: vi.fn(),
    updateMany: vi.fn(), countByStatus: vi.fn(), delete: vi.fn(),
    // File-backed accessors: JD text and workspace dir now live behind the repo.
    readJdText: vi.fn().mockResolvedValue('Build cool stuff with Go.'),
    writeJdText: vi.fn(),
    getWorkspaceDir: vi.fn().mockResolvedValue('/workspace/data/jobs/company-1_SWE_job-1'),
  } as unknown as JobRepository;
}

function makeProfileRepo(overrides: { profile?: Profile; resumePool?: string } = {}): ProfileRepository {
  // Only the methods this service uses are stubbed; the rest stay as bare vi.fn()
  // so accidental calls to unmocked methods surface as test failures.
  const profile = overrides.profile ?? FAKE_PROFILE;
  const pool = overrides.resumePool ?? FAKE_RESUME_POOL;
  return {
    get: vi.fn(),
    getDefault: vi.fn().mockResolvedValue(profile),
    list: vi.fn(),
    getProfileMd: vi.fn().mockResolvedValue(profile.md),
    getResumePool: vi.fn().mockResolvedValue(pool),
    getStandardQuestions: vi.fn(),
    getAttachmentsList: vi.fn().mockResolvedValue([]),
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
  profileRepo?: ProfileRepository;
  rewriteSvc?: ResumeCoverLetterService;
  briefSvc?: TailoringBriefService;
} = {}) {
  return new TailorApplicationServiceImpl(
    overrides.jobRepo ?? makeJobRepo(),
    overrides.profileRepo ?? makeProfileRepo(),
    makeRenderSvc(),
    overrides.rewriteSvc ?? makeRewriteSvc(),
    overrides.briefSvc ?? makeBriefSvc(),
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

  // Hint: when no hint parameter is given and hint.md has only the alert
  // header (no real user content), the analyst is called with hint=undefined
  // (stripComments removes the alert block, leaving the file effectively empty).
  it('passes hint=undefined when hint.md contains only the alert header', async () => {
    const briefSvc = makeBriefSvc();
    const svc = makeSvc({ briefSvc });
    await svc.analyze({ jobId: 'job-1' });
    const hintArg = vi.mocked(briefSvc.analyze).mock.calls[0][4];
    expect(hintArg).toBeUndefined();
  });

  // Hint: active hint content (after stripping the > [!TIP] header) is
  // forwarded to the analyst.
  it('forwards active hint text to the analyst when hint.md has non-alert content', async () => {
    const { readFile } = await import('node:fs/promises');
    // Path-aware override: hint.md returns real content; brief.md stays as before.
    // Using `as never` keeps vitest's narrow signature happy without widening the mock.
    vi.mocked(readFile).mockImplementation(((p: string) =>
      p.endsWith('hint.md')
        ? Promise.resolve('> [!TIP]\n> header alert\n\nfocus on distributed systems\n')
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
    // After stripping the GitHub-Alert header block, what reaches the AI
    // should be effectively empty (modulo whitespace).
    const { stripComments } = await import('../../utils/stripComments.js');
    // Mirror the production hint.md path: dropEmptyH2s: true so the
    // assertion exercises the exact transform tailor uses on hint.md.
    expect(stripComments(body, { dropEmptyH2s: true }).trim()).toBe('');
  });

  // ---------------------------------------------------------------------------
  // Pre-flight validation: refuse to run tailor on a placeholder profile
  // (missing legal name / email / phone) or on a near-empty resume pool.
  // The AI would otherwise faithfully render "Job Title — Company Name" /
  // empty <h1></h1> headers; far better to fail at the boundary with a clear
  // message that names the file the user must edit.
  // ---------------------------------------------------------------------------

  it('refuses tailor when profile.md is missing required fields (Legal first name)', async () => {
    const profileMissingFirstName: Profile = {
      name: 'default',
      // Identity has only Last name; First name H2 absent → assertReady fails.
      md: '# Identity\n\n## Legal last name\nRivera\n\n# Contact\n\n## Email\nx@x.test\n\n## Phone\n+1\n',
    };
    const svc = makeSvc({ profileRepo: makeProfileRepo({ profile: profileMissingFirstName }) });
    await expect(svc.tailor({ jobId: 'job-1' })).rejects.toThrow(/Legal first name/);
  });

  // Regression: an H2 whose body is only a `> [!IMPORTANT]` callout (the
  // un-edited template state right after `wolf init`) must NOT be treated
  // as filled. assertReadyForTailor strips alert blocks before extracting,
  // matching what the AI actually sees.
  it('refuses tailor when profile.md required field body is only a > [!IMPORTANT] callout (fresh init state)', async () => {
    const calloutOnlyProfile: Profile = {
      name: 'default',
      md: [
        '## Legal first name',
        '> [!IMPORTANT]',
        '> you must answer; AI cannot guess this.',
        '## Legal last name',
        'Rivera',
        '## Email',
        'r@x.test',
        '## Phone',
        '+1 555 0100',
      ].join('\n'),
    };
    const svc = makeSvc({ profileRepo: makeProfileRepo({ profile: calloutOnlyProfile }) });
    await expect(svc.tailor({ jobId: 'job-1' })).rejects.toThrow(/Legal first name/);
  });

  it('refuses tailor when profile.md required field is blank-bodied', async () => {
    const profileBlankEmail: Profile = {
      name: 'default',
      md: '## Legal first name\nAlex\n## Legal last name\nRivera\n## Email\n\n## Phone\n+1\n',
    };
    const svc = makeSvc({ profileRepo: makeProfileRepo({ profile: profileBlankEmail }) });
    await expect(svc.tailor({ jobId: 'job-1' })).rejects.toThrow(/Email/);
  });

  it('refuses tailor when resume_pool.md has only placeholder examples (post-strip empty)', async () => {
    // Mimics what `wolf init --empty` produces now: every example block lives
    // inside a > [!TIP] alert, so stripComments removes them and only the H2
    // headings remain. No bullets, no real content, nothing to tailor from.
    const placeholderPool = [
      '# Resume Pool',
      '## Experience',
      '> [!TIP]',
      '> EXAMPLE',
      '> ### Job Title — Company Name',
      '> *Month Year - Month Year*',
      '> - Bullet describing impact',
      '## Skills',
      '> [!TIP]',
      '> EXAMPLE',
      '> TypeScript, Python, SQL',
    ].join('\n');
    const svc = makeSvc({ profileRepo: makeProfileRepo({ resumePool: placeholderPool }) });
    await expect(svc.tailor({ jobId: 'job-1' })).rejects.toThrow(/empty or only has placeholder/);
  });

  it('does NOT refuse when the pool is sparse but real (≥ 5 substantive lines)', async () => {
    // Above the threshold — proves we don't over-reject realistic NG/intern pools
    // (one role with a couple bullets + a degree + a skills line is enough).
    const sparseRealPool = [
      '# Resume Pool',
      '## Experience',
      '### Software Engineer Intern — Acme',
      '*Summer 2024*',
      '- Built ETL pipelines processing 10M rows/day.',
      '- Wrote integration tests; raised coverage 40%→78%.',
      '## Education',
      '### B.S. CS — State University',
      '*2021 - 2025*',
      '## Skills',
      'Python, SQL, Git, Linux, Postgres',
    ].join('\n');
    const svc = makeSvc({ profileRepo: makeProfileRepo({ resumePool: sparseRealPool }) });
    await expect(svc.tailor({ jobId: 'job-1' })).resolves.toMatchObject({
      tailoredPdfPath: expect.stringContaining('resume.pdf'),
    });
  });
});
