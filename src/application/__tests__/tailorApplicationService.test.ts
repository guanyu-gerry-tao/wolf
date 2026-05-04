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

function makeProfileRepo(overrides: { profile?: Profile; resumePool?: string; tomlOverrides?: Record<string, unknown> } = {}): ProfileRepository {
  // Only the methods this service uses are stubbed; the rest stay as bare vi.fn()
  // so accidental calls to unmocked methods surface as test failures.
  const profile = overrides.profile ?? FAKE_PROFILE;
  const pool = overrides.resumePool ?? FAKE_RESUME_POOL;

  // Build a minimal-but-passing ProfileToml. Tailor's assertReadyForTailor
  // checks REQUIRED PROFILE_FIELDS + ≥ 5 resume entries. Provide enough
  // structure to clear both gates.
  return {
    get: vi.fn(),
    getDefault: vi.fn().mockResolvedValue(profile),
    list: vi.fn(),
    getProfileToml: vi.fn().mockImplementation(async () => {
      const { parseProfileToml } = await import('../../utils/profileToml.js');
      const { profileTomlTemplate } = await import('../../utils/profileTomlGenerate.js');
      const parsed = parseProfileToml(profileTomlTemplate);
      // Fill REQUIRED scalar fields so assertReadyForTailor's loop passes.
      const populated = {
        ...parsed,
        identity: {
          ...parsed.identity,
          legal_first_name: 'Alex',
          legal_last_name: 'Rivera',
          country_of_citizenship: 'United States',
        },
        contact: { ...parsed.contact, email: 'alex@example.test', phone: '+1 555 010 0100' },
        address: { ...parsed.address, full: '123 Main St, SF, CA 94102, USA' },
        links: { ...parsed.links, first: 'https://linkedin.com/in/alex' },
        job_preferences: {
          ...parsed.job_preferences,
          target_roles: '- SWE',
          target_locations: '- SF Bay Area',
        },
        // β.10g: form_answers absorbed into [[question]] — REQ short answers
        // are now builtin question entries with default ids.
        question: parsed.question.map((q) => {
          const required: Record<string, string> = {
            authorized_to_work: 'Yes',
            require_sponsorship: 'No',
            willing_to_relocate: 'Yes',
          };
          return q.id in required ? { ...q, answer: required[q.id] } : q;
        }),
        // Five filled "resume entries" to clear the ≥ 5 threshold.
        // β.10i collapsed skills to one freeform `text` (worth 1 entry),
        // so we add 4 experiences + 1 skills block instead of 1+5-buckets.
        experience: [
          { id: 'acme-2024', job_title: 'SWE', company: 'Acme', start: '2022', end: '2025', location: '', bullets: '- Built distributed systems', subnote: '' },
          { id: 'beta-2023', job_title: 'Eng', company: 'Beta', start: '2021', end: '2022', location: '', bullets: '- Latency win', subnote: '' },
          { id: 'gamma-2022', job_title: 'Eng', company: 'Gamma', start: '2020', end: '2021', location: '', bullets: '- TS migration', subnote: '' },
          { id: 'delta-2021', job_title: 'Intern', company: 'Delta', start: '2019', end: '2020', location: '', bullets: '- Form fill', subnote: '' },
        ],
        skills: {
          text: 'TypeScript / React / Git / Backend',
        },
        ...overrides.tomlOverrides,
      };
      return populated;
    }),
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

  it('refuses tailor when REQUIRED profile field is empty (legal_first_name)', async () => {
    const svc = makeSvc({
      profileRepo: makeProfileRepo({
        tomlOverrides: {
          identity: {
            legal_first_name: '',
            legal_middle_name: '',
            legal_last_name: 'Rivera',
            preferred_name: '',
            pronouns: '',
            date_of_birth: '',
            country_of_citizenship: 'United States',
            country_currently_in: 'United States',
            note: '',
          },
        },
      }),
    });
    await expect(svc.tailor({ jobId: 'job-1' })).rejects.toThrow(/identity\.legal_first_name/);
  });

  it('refuses tailor when REQUIRED profile field is whitespace-only (isFilled trim contract)', async () => {
    const svc = makeSvc({
      profileRepo: makeProfileRepo({
        tomlOverrides: {
          contact: {
            email: '   \n  \n   ',  // whitespace-only counts as not-filled
            phone: '+1 555 0100',
            note: '',
          },
        },
      }),
    });
    await expect(svc.tailor({ jobId: 'job-1' })).rejects.toThrow(/contact\.email/);
  });

  it('refuses tailor when resume content is sparse (< 5 entries / skill groups)', async () => {
    const svc = makeSvc({
      profileRepo: makeProfileRepo({
        tomlOverrides: {
          experience: [],
          project: [],
          education: [],
          skills: { text: '' },
        },
      }),
    });
    await expect(svc.tailor({ jobId: 'job-1' })).rejects.toThrow(/too sparse/);
  });

  it('does NOT refuse when the resume content has ≥ 5 entries (1 experience + 4 skill buckets)', async () => {
    // The default makeProfileRepo() builds exactly that — one experience
    // entry plus four filled skill buckets. tailor should run end-to-end.
    const svc = makeSvc();
    await expect(svc.tailor({ jobId: 'job-1' })).resolves.toMatchObject({
      tailoredPdfPath: expect.stringContaining('resume.pdf'),
    });
  });
});
