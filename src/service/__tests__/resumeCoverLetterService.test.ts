import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResumeCoverLetterServiceImpl } from '../impl/resumeCoverLetterServiceImpl.js';
import type { UserProfile } from '../../types/index.js';
import type { AiConfig } from '../../types/index.js';

// Mock aiClient so tests never make real API calls.
vi.mock('../../utils/ai/index.js', () => ({
  aiClient: vi.fn(),
}));

import { aiClient } from '../../utils/ai/index.js';

const PROFILE: UserProfile = {
  id: 'default',
  label: 'Default',
  name: 'Alex Rivera',
  email: 'alex@example.com',
  phone: '+1 555 000 0000',
  firstUrl: 'linkedin.com/in/alex',
  secondUrl: 'github.com/alex',
  thirdUrl: null,
  immigrationStatus: 'no limit',
  willingToRelocate: 'no',
  targetRoles: ['Software Engineer'],
  targetLocations: ['Remote'],
  scoringNotes: null,
};

const RESUME_POOL = `# EXPERIENCE
Senior SWE at Example Corp (2022-present): built distributed systems.
# SKILLS
TypeScript, Go, PostgreSQL`;

const JD_TEXT = 'We are looking for a backend engineer with Go and TypeScript experience.';
const BRIEF = '# Tailoring Brief\n## Selected Roles\nSWE at Example Corp';

const AI_CONFIG: AiConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };

describe('ResumeCoverLetterServiceImpl', () => {
  beforeEach(() => vi.clearAllMocks());

  // Happy path: verify prompt includes brief, resume pool, and JD.
  it('calls aiClient with a prompt containing brief, resume pool and JD', async () => {
    const htmlBody = '<h2>EXPERIENCE</h2>';
    vi.mocked(aiClient).mockResolvedValue(htmlBody);

    const svc = new ResumeCoverLetterServiceImpl();
    const result = await svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE, BRIEF, AI_CONFIG);

    expect(result).toBe(htmlBody);
    expect(aiClient).toHaveBeenCalledOnce();
    const [prompt, systemPrompt] = vi.mocked(aiClient).mock.calls[0];
    expect(prompt).toContain(RESUME_POOL);
    expect(prompt).toContain(JD_TEXT);
    expect(prompt).toContain(BRIEF);
    expect(systemPrompt).toContain('HTML');
  });

  it('trims the returned HTML body', async () => {
    vi.mocked(aiClient).mockResolvedValue('  <h2>EXPERIENCE</h2>  \n');
    const svc = new ResumeCoverLetterServiceImpl();
    const result = await svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE, BRIEF, AI_CONFIG);
    expect(result).toBe('<h2>EXPERIENCE</h2>');
  });

  it('throws if aiClient returns empty string', async () => {
    vi.mocked(aiClient).mockResolvedValue('');
    const svc = new ResumeCoverLetterServiceImpl();
    await expect(svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE, BRIEF, AI_CONFIG)).rejects.toThrow('empty');
  });

  it('passes aiConfig provider and model to aiClient', async () => {
    vi.mocked(aiClient).mockResolvedValue('<h1>Result</h1>');
    const customConfig: AiConfig = { provider: 'openai', model: 'gpt-4o' };
    const svc = new ResumeCoverLetterServiceImpl();
    await svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE, BRIEF, customConfig);
    const [, , options] = vi.mocked(aiClient).mock.calls[0];
    expect(options).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  const TONE = 'professional';

  // Cover letter: prompt must include brief, JD, profile, and tone.
  it('calls aiClient with prompt containing brief, JD and profile for cover letter', async () => {
    vi.mocked(aiClient).mockResolvedValue('<p>Dear Hiring Manager, I am excited...</p>');
    const svc = new ResumeCoverLetterServiceImpl();
    const result = await svc.generateCoverLetter(RESUME_POOL, JD_TEXT, PROFILE, BRIEF, TONE, AI_CONFIG);
    expect(result).toContain('Dear Hiring Manager');
    const [prompt, systemPrompt] = vi.mocked(aiClient).mock.calls[0];
    expect(prompt).toContain(JD_TEXT);
    expect(prompt).toContain(PROFILE.name);
    expect(prompt).toContain(BRIEF);
    expect(prompt).toContain(TONE);
    expect(systemPrompt).toContain('cover letter');
  });

  it('throws if aiClient returns empty string for cover letter', async () => {
    vi.mocked(aiClient).mockResolvedValue('');
    const svc = new ResumeCoverLetterServiceImpl();
    await expect(
      svc.generateCoverLetter(RESUME_POOL, JD_TEXT, PROFILE, BRIEF, TONE, AI_CONFIG),
    ).rejects.toThrow('empty');
  });
});
