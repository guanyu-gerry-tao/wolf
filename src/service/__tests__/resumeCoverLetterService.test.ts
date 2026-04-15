import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResumeCoverLetterServiceImpl } from '../impl/resumeCoverLetterServiceImpl.js';
import type { UserProfile } from '../../types/index.js';
import type { AiConfig } from '../../types/index.js';

// Mock aiClient so tests never make real API calls.
vi.mock('../../utils/ai.js', () => ({
  aiClient: vi.fn(),
}));

import { aiClient } from '../../utils/ai.js';

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
  willingToRelocate: false,
  targetRoles: ['Software Engineer'],
  targetLocations: ['Remote'],
  scoringNotes: null,
};

const RESUME_POOL = `# EXPERIENCE
Senior SWE at Example Corp (2022–present): built distributed systems.
# SKILLS
TypeScript, Go, PostgreSQL`;

const JD_TEXT = 'We are looking for a backend engineer with Go and TypeScript experience.';

// Default AI config used across all tests — matches production default.
const AI_CONFIG: AiConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };

describe('ResumeCoverLetterServiceImpl', () => {
  beforeEach(() => vi.clearAllMocks());

  // Happy path: AI returns valid HTML — check that prompt contains the right inputs.
  it('calls aiClient with a prompt containing resume pool and JD', async () => {
    const htmlBody = '<h2>EXPERIENCE</h2><div class="item"><div class="item-header"><span>SWE, Acme</span><span>2022–Present</span></div><ul><li>Built things in Go.</li></ul></div>';
    vi.mocked(aiClient).mockResolvedValue(htmlBody);

    const svc = new ResumeCoverLetterServiceImpl();
    const result = await svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE, AI_CONFIG);

    expect(result).toBe(htmlBody);
    expect(aiClient).toHaveBeenCalledOnce();
    // Verify the resume pool and JD are both included in the prompt.
    const [prompt, systemPrompt] = vi.mocked(aiClient).mock.calls[0];
    expect(prompt).toContain(RESUME_POOL);
    expect(prompt).toContain(JD_TEXT);
    // System prompt must instruct the AI to output HTML.
    expect(systemPrompt).toContain('HTML');
  });

  // Whitespace trimming: AI sometimes pads output — the service must strip it.
  it('trims the returned HTML body', async () => {
    vi.mocked(aiClient).mockResolvedValue('  <h2>EXPERIENCE</h2>  \n');
    const svc = new ResumeCoverLetterServiceImpl();
    const result = await svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE, AI_CONFIG);
    expect(result).toBe('<h2>EXPERIENCE</h2>');
  });

  // Guard against empty response — AI can return '' on refusal or error.
  it('throws if aiClient returns empty string', async () => {
    vi.mocked(aiClient).mockResolvedValue('');
    const svc = new ResumeCoverLetterServiceImpl();
    await expect(svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE, AI_CONFIG)).rejects.toThrow('empty');
  });

  // Verify that the aiConfig provider and model are forwarded to the AI client.
  it('passes aiConfig provider and model to aiClient', async () => {
    vi.mocked(aiClient).mockResolvedValue('<h1>Result</h1>');
    const customConfig: AiConfig = { provider: 'openai', model: 'gpt-4o' };
    const svc = new ResumeCoverLetterServiceImpl();
    await svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE, customConfig);
    const [, , options] = vi.mocked(aiClient).mock.calls[0];
    expect(options).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  const TONE = 'professional';

  // Happy path: AI returns cover letter HTML — verify prompt contains JD and candidate name.
  it('calls aiClient with prompt containing JD and profile name for cover letter', async () => {
    vi.mocked(aiClient).mockResolvedValue('<p>Dear Hiring Manager, I am excited...</p>');
    const svc = new ResumeCoverLetterServiceImpl();
    const result = await svc.generateCoverLetter(RESUME_POOL, JD_TEXT, PROFILE, TONE, AI_CONFIG);
    expect(result).toContain('Dear Hiring Manager');
    const [prompt, systemPrompt] = vi.mocked(aiClient).mock.calls[0];
    expect(prompt).toContain(JD_TEXT);
    expect(prompt).toContain(PROFILE.name);
    // System prompt must mention cover letter.
    expect(systemPrompt).toContain('cover letter');
  });

  // Guard against empty AI response for cover letter generation.
  it('throws if aiClient returns empty string for cover letter', async () => {
    vi.mocked(aiClient).mockResolvedValue('');
    const svc = new ResumeCoverLetterServiceImpl();
    await expect(
      svc.generateCoverLetter(RESUME_POOL, JD_TEXT, PROFILE, TONE, AI_CONFIG),
    ).rejects.toThrow('empty');
  });
});
