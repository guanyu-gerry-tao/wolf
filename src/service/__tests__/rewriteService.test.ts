import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RewriteServiceImpl } from '../impl/rewriteServiceImpl.js';
import type { UserProfile } from '../../types/index.js';

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

describe('RewriteServiceImpl', () => {
  beforeEach(() => vi.clearAllMocks());

  // Happy path: Claude returns valid HTML — check that prompt contains the right inputs.
  it('calls aiClient with a prompt containing resume pool and JD', async () => {
    const htmlBody = '<h2>EXPERIENCE</h2><div class="item"><div class="item-header"><span>SWE, Acme</span><span>2022–Present</span></div><ul><li>Built things in Go.</li></ul></div>';
    vi.mocked(aiClient).mockResolvedValue(htmlBody);

    const svc = new RewriteServiceImpl();
    const result = await svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE);

    expect(result).toBe(htmlBody);
    expect(aiClient).toHaveBeenCalledOnce();
    // Verify the resume pool and JD are both included in the prompt.
    const [prompt, systemPrompt] = vi.mocked(aiClient).mock.calls[0];
    expect(prompt).toContain(RESUME_POOL);
    expect(prompt).toContain(JD_TEXT);
    // System prompt must instruct Claude to output HTML.
    expect(systemPrompt).toContain('HTML');
  });

  // Whitespace trimming: Claude sometimes pads output — the service must strip it.
  it('trims the returned HTML body', async () => {
    vi.mocked(aiClient).mockResolvedValue('  <h2>EXPERIENCE</h2>  \n');
    const svc = new RewriteServiceImpl();
    const result = await svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE);
    expect(result).toBe('<h2>EXPERIENCE</h2>');
  });

  // Guard against empty response — Claude can return '' on refusal or error.
  it('throws if aiClient returns empty string', async () => {
    vi.mocked(aiClient).mockResolvedValue('');
    const svc = new RewriteServiceImpl();
    await expect(svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE)).rejects.toThrow('empty');
  });
});
