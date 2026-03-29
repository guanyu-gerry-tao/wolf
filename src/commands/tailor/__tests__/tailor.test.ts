/**
 * Tests for commands/tailor/index.ts
 *
 * All external I/O is mocked:
 * - initDb / getJob / updateJob — db layer
 * - loadConfig — config layer
 * - Anthropic SDK — no real API calls
 * - fs — no real file writes
 * - child_process execFile — no real pdflatex/pdftoppm calls
 * - resume-snapshot — returns a fixed filename
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from '../../../types/index.js';

// ── Mocks (must be hoisted before imports) ────────────────────────────────

vi.mock('../../../utils/db.js', () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  getJob: vi.fn(),
  updateJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../utils/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    defaultProfileId: 'default',
    profiles: [{ id: 'default', resumePath: '/workspace/resume/resume.tex' }],
  }),
}));

vi.mock('../../../utils/resume-snapshot.js', () => ({
  snapshotResume: vi.fn().mockResolvedValue('master_a3f2c1.tex'),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn((filePath: string) => {
      if (String(filePath).endsWith('.tex')) {
        return Promise.resolve('\\documentclass{article}\n\\begin{document}hello\\end{document}');
      }
      return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    }),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    mkdtemp: vi.fn().mockResolvedValue('/tmp/wolf-test'),
    rm: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (err: null, stdout: string) => void) => {
    cb(null, '');
  }),
}));

const mockCreate = vi.fn().mockResolvedValue({
  content: [{
    type: 'text',
    text: '\\documentclass{article}\n\\begin{document}\nTailored content\n\\end{document}\n%WOLF_META{"matchScore":0.82,"changes":["Rewrote bullet 1","Added keyword X"]}',
  }],
});

vi.mock('@anthropic-ai/sdk', () => {
  const AnthropicMock = function () {
    return { messages: { create: mockCreate } };
  };
  return { default: AnthropicMock };
});

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
  masterResumeSnapshot: null,
  createdAt: '2026-03-29T00:00:00.000Z',
  updatedAt: '2026-03-29T00:00:00.000Z',
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('tailor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJob.mockResolvedValue(baseJob());
    mockLoadConfig.mockResolvedValue({
      defaultProfileId: 'default',
      profiles: [{ id: 'default', resumePath: '/workspace/resume/resume.tex' }],
    } as never);
    // Restore default Claude response
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '\\documentclass{article}\n\\begin{document}\nTailored\n\\end{document}\n%WOLF_META{"matchScore":0.82,"changes":["Rewrote bullet 1","Added keyword X"]}',
      }],
    });
  });

  it('returns tailoredTexPath containing the jobId', async () => {
    const result = await tailor({ jobId: 'job-123' });
    expect(result.tailoredTexPath).toContain('job-123.tex');
  });

  it('returns matchScore from WOLF_META', async () => {
    const result = await tailor({ jobId: 'job-123' });
    expect(result.matchScore).toBe(0.82);
  });

  it('returns changes array from WOLF_META', async () => {
    const result = await tailor({ jobId: 'job-123' });
    expect(result.changes).toEqual(['Rewrote bullet 1', 'Added keyword X']);
  });

  it('calls updateJob with tailoredResumePath and masterResumeSnapshot', async () => {
    await tailor({ jobId: 'job-123' });
    expect(mockUpdateJob).toHaveBeenCalledWith('job-123', expect.objectContaining({
      tailoredResumePath: expect.stringContaining('job-123.tex'),
      masterResumeSnapshot: 'master_a3f2c1.tex',
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
});
