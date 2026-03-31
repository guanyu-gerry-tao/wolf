/**
 * Tests for commands/tailor/index.ts
 *
 * All external I/O is mocked:
 * - initDb / getJob / getCompany / updateJob — db layer
 * - loadConfig — config layer
 * - Anthropic SDK — no real API calls
 * - fs — no real file reads/writes
 * - child_process execFile — no real pdflatex/pdftoppm calls
 * - resume-snapshot — fixed return values
 * - fs-helpers — fixed path values
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from '../../../types/index.js';

// ── Mocks (must be hoisted before imports) ────────────────────────────────

vi.mock('../../../utils/db.js', () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  getJob: vi.fn(),
  getCompany: vi.fn().mockResolvedValue({ id: 'company-1', name: 'Google' }),
  updateJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../utils/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    defaultProfileId: 'default',
    profiles: [{ id: 'default', label: 'Default' }],
  }),
}));

vi.mock('../../../utils/resume-snapshot.js', () => ({
  fileExists: vi.fn().mockImplementation((p: string) => {
    if (String(p).endsWith('style_ref.jpg')) return Promise.resolve(false);
    return Promise.resolve(true);
  }),
  snapshotAsset: vi.fn().mockImplementation((_path: string, type: string) => {
    if (type === 'txt') return Promise.resolve('resume_a3f2c1.txt');
    if (type === 'tex') return Promise.resolve('template_c5f3e4.tex');
    return Promise.resolve('style_b4e1d2.jpg');
  }),
}));

vi.mock('../../../utils/fs-helpers.js', () => ({
  profileDir: vi.fn(() => '/workspace/data/default_default'),
  generalResumeDir: vi.fn(() => '/workspace/data/default_default/general_resume'),
  jobOutputDir: vi.fn(() => '/workspace/data/default_default/google_swe_job-123'),
  jobSnapshotsDir: vi.fn((dir: string) => `${dir}/snapshots`),
  resumeTxtPath: vi.fn(() => '/workspace/data/default_default/resume.txt'),
  styleRefPath: vi.fn(() => '/workspace/data/default_default/style_ref.jpg'),
}));

// vi.hoisted ensures this is initialised before vi.mock factories run
const mockReaddir = vi.hoisted(() => vi.fn().mockResolvedValue(['p-1.png']));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn((filePath: string) => {
      if (String(filePath).endsWith('.tex') || String(filePath).endsWith('resume.tex')) {
        return Promise.resolve('\\documentclass{article}\n\\begin{document}hello\\end{document}');
      }
      if (String(filePath).endsWith('.txt') || String(filePath).endsWith('resume.txt')) {
        return Promise.resolve('=======Work Experience=======\n// comment\nEngineer at Acme Corp');
      }
      if (String(filePath).endsWith('.md')) {
        return Promise.resolve('# Jane Doe\njane@example.com | 555-1234\n\nDear Hiring Manager...');
      }
      if (String(filePath).endsWith('.png')) {
        return Promise.resolve(Buffer.from('fakepng'));
      }
      return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    }),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: mockReaddir,
  },
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (err: null, stdout: string) => void) => {
    cb(null, '');
  }),
}));

const TEX_WITH_META = '\\documentclass{article}\n\\begin{document}\nTailored content\n\\end{document}\n%WOLF_META{"matchScore":0.82,"changes":["Rewrote bullet 1","Added keyword X"]}';

// Smart mock: distinguishes refinement calls (image blocks → LGTM),
// CL generation calls (prompt contains "cover letter writer" → CL markdown),
// and initial tailor calls (everything else → tailored tex + WOLF_META).
const mockCreate = vi.fn().mockImplementation((args: { messages: Array<{ role: string; content: unknown }> }) => {
  const firstMsg = args.messages?.[0];
  const hasImages = Array.isArray(firstMsg?.content) &&
    (firstMsg.content as Array<{ type: string }>).some(c => c.type === 'image');
  if (hasImages) {
    return Promise.resolve({ content: [{ type: 'text', text: 'LGTM' }] });
  }
  const textContent = typeof firstMsg?.content === 'string' ? firstMsg.content : '';
  if (textContent.includes('cover letter writer')) {
    return Promise.resolve({ content: [{ type: 'text', text: '# Jane Doe\njane@example.com | 555-1234\n\nDear Hiring Manager...' }] });
  }
  return Promise.resolve({ content: [{ type: 'text', text: TEX_WITH_META }] });
});

vi.mock('@anthropic-ai/sdk', () => {
  const AnthropicMock = function () {
    return { messages: { create: mockCreate } };
  };
  return { default: AnthropicMock };
});

vi.mock('md-to-pdf', () => ({
  mdToPdf: vi.fn().mockResolvedValue({ filename: '/workspace/data/default_default/google_swe_job-123/cover_letter.pdf' }),
}));


// ── Imports (after mocks) ─────────────────────────────────────────────────

import { tailor } from '../index.js';
import { getJob, updateJob } from '../../../utils/db.js';
import { loadConfig } from '../../../utils/config.js';

const mockGetJob = vi.mocked(getJob);
const mockUpdateJob = vi.mocked(updateJob);
const mockLoadConfig = vi.mocked(loadConfig);

// ── Fixture ───────────────────────────────────────────────────────────────

const baseJob = (): Job => ({
  id: 'job-123',
  title: 'Software Engineer',
  companyId: 'company-1',
  url: 'https://example.com/jobs/1',
  source: 'manual',
  description: 'We are looking for a skilled engineer...',
  location: 'New York, NY',
  remote: false,
  salary: null,
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
  resumeSnapshot: null,
  styleSnapshot: null,
  texSnapshot: null,
  createdAt: '2026-03-29T00:00:00.000Z',
  updatedAt: '2026-03-29T00:00:00.000Z',
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('tailor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReaddir.mockResolvedValue(['p-1.png']); // default: 1 page
    mockGetJob.mockResolvedValue(baseJob());
    mockLoadConfig.mockResolvedValue({
      defaultProfileId: 'default',
      profiles: [{ id: 'default', label: 'Default', name: 'Jane Doe', email: 'jane@example.com', phone: '555-1234' }],
    } as never);
    mockCreate.mockImplementation((args: { messages: Array<{ role: string; content: unknown }> }) => {
      const firstMsg = args.messages?.[0];
      const hasImages = Array.isArray(firstMsg?.content) &&
        (firstMsg.content as Array<{ type: string }>).some(c => c.type === 'image');
      if (hasImages) return Promise.resolve({ content: [{ type: 'text', text: 'LGTM' }] });
      const text = typeof firstMsg?.content === 'string' ? firstMsg.content : '';
      if (text.includes('cover letter writer')) {
        return Promise.resolve({ content: [{ type: 'text', text: '# Jane Doe\njane@example.com | 555-1234\n\nDear Hiring Manager...' }] });
      }
      return Promise.resolve({ content: [{ type: 'text', text: TEX_WITH_META }] });
    });
  });

  it('returns tailoredTexPath containing the jobId', async () => {
    const result = await tailor({ jobId: 'job-123' });
    expect(result.tailoredTexPath).toContain('job-123');
  });

  it('returns matchScore from WOLF_META', async () => {
    const result = await tailor({ jobId: 'job-123' });
    expect(result.matchScore).toBe(0.82);
  });

  it('returns changes array from WOLF_META', async () => {
    const result = await tailor({ jobId: 'job-123' });
    expect(result.changes).toEqual(['Rewrote bullet 1', 'Added keyword X']);
  });

  it('calls updateJob with resumeSnapshot and texSnapshot', async () => {
    await tailor({ jobId: 'job-123' });
    expect(mockUpdateJob).toHaveBeenCalledWith('job-123', expect.objectContaining({
      tailoredResumePath: expect.stringContaining('resume.tex'),
      resumeSnapshot: 'resume_a3f2c1.txt',
      texSnapshot: 'template_c5f3e4.tex',
      styleSnapshot: null,
    }));
  });

  it('throws if job not found', async () => {
    mockGetJob.mockResolvedValue(null);
    await expect(tailor({ jobId: 'nonexistent' })).rejects.toThrow('Job not found');
  });

  it('throws if profile not found', async () => {
    mockLoadConfig.mockResolvedValue({
      defaultProfileId: 'default',
      profiles: [],
    } as never);
    await expect(tailor({ jobId: 'job-123' })).rejects.toThrow('Profile not found');
  });

  it('throws if Claude returns invalid LaTeX', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'This is not LaTeX at all.' }],
    });
    await expect(tailor({ jobId: 'job-123' })).rejects.toThrow('invalid LaTeX');
  });

  it('returns matchScore 0 and empty changes when WOLF_META is missing', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '\\documentclass{article}\n\\begin{document}ok\\end{document}' }],
    });
    const result = await tailor({ jobId: 'job-123' });
    expect(result.matchScore).toBe(0);
    expect(result.changes).toEqual([]);
  });

  it('returns null coverLetterMdPath when coverLetter is false (default)', async () => {
    const result = await tailor({ jobId: 'job-123' });
    expect(result.coverLetterMdPath).toBeNull();
    expect(result.coverLetterPdfPath).toBeNull();
  });

  it('returns coverLetterMdPath and coverLetterPdfPath when coverLetter is true', async () => {
    const result = await tailor({ jobId: 'job-123', coverLetter: true });
    expect(result.coverLetterMdPath).toContain('cover_letter.md');
    expect(result.coverLetterPdfPath).toContain('cover_letter.pdf');
  });

  it('calls updateJob with coverLetterPath when coverLetter is true', async () => {
    await tailor({ jobId: 'job-123', coverLetter: true });
    expect(mockUpdateJob).toHaveBeenCalledWith('job-123', expect.objectContaining({
      coverLetterPath: expect.stringContaining('cover_letter.md'),
      coverLetterPdfPath: expect.stringContaining('cover_letter.pdf'),
    }));
  });

  describe('refinement loop (page count control)', () => {
    // Helper: builds a mockCreate implementation with image-call tracking
    function makeRefinementMock(onImageCall: (callNumber: number) => { content: [{ type: 'text'; text: string }] }) {
      let imageCallCount = 0;
      return (args: { messages: Array<{ role: string; content: unknown }> }) => {
        const firstMsg = args.messages?.[0];
        const hasImages = Array.isArray(firstMsg?.content) &&
          (firstMsg.content as Array<{ type: string }>).some(c => c.type === 'image');
        if (hasImages) return Promise.resolve(onImageCall(++imageCallCount));
        const text = typeof firstMsg?.content === 'string' ? firstMsg.content : '';
        if (text.includes('cover letter writer')) {
          return Promise.resolve({ content: [{ type: 'text', text: '# Jane Doe\nDear Hiring Manager...' }] });
        }
        return Promise.resolve({ content: [{ type: 'text', text: TEX_WITH_META }] });
      };
    }

    it('asks Claude to revise when PDF overflows maxResumePages, then accepts LGTM', async () => {
      // First check: 2 pages (overflow) → Claude revises; second check: 1 page → LGTM
      mockReaddir
        .mockResolvedValueOnce(['p-1.png', 'p-2.png'])
        .mockResolvedValue(['p-1.png']);

      let refinementCalls = 0;
      mockCreate.mockImplementation(makeRefinementMock((n) => {
        refinementCalls = n;
        if (n === 1) {
          // overflow: return condensed tex
          return { content: [{ type: 'text', text: '\\documentclass{article}\n\\begin{document}\nShortened\n\\end{document}' }] };
        }
        return { content: [{ type: 'text', text: 'LGTM' }] };
      }));

      await tailor({ jobId: 'job-123' });
      expect(refinementCalls).toBe(2);
    });

    it('stops after MAX_ITER (5) refinement calls even if Claude never returns LGTM', async () => {
      // Always overflow — Claude always returns revised tex, never LGTM
      mockReaddir.mockResolvedValue(['p-1.png', 'p-2.png']);

      let refinementCalls = 0;
      mockCreate.mockImplementation(makeRefinementMock((n) => {
        refinementCalls = n;
        return { content: [{ type: 'text', text: '\\documentclass{article}\n\\begin{document}\nRevised\n\\end{document}' }] };
      }));

      await tailor({ jobId: 'job-123' });
      expect(refinementCalls).toBe(5);
    });
  });
});
