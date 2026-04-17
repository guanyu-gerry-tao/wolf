import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TailoringBriefServiceImpl } from '../impl/tailoringBriefServiceImpl.js';
import type { UserProfile, AiConfig } from '../../types/index.js';

// Mock aiClient so tests never touch the network.
vi.mock('../../utils/ai/index.js', () => ({
  aiClient: vi.fn(),
}));

import { aiClient } from '../../utils/ai/index.js';

const PROFILE: UserProfile = {
  id: 'default', label: 'Default', name: 'Alex', email: 'alex@example.com',
  phone: '+1 555 000 0000', firstUrl: null, secondUrl: null, thirdUrl: null,
  immigrationStatus: 'no limit', willingToRelocate: 'no',
  targetRoles: ['SWE'], targetLocations: ['Remote'], scoringNotes: null,
};
const POOL = '# EXPERIENCE\nSenior SWE at Acme (2022-present)';
const JD = 'Looking for backend engineer with Go experience';
const AI: AiConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };

describe('TailoringBriefService', () => {
  beforeEach(() => vi.clearAllMocks());

  // Happy path: without a hint, the user prompt does not include a User Guidance section.
  // This guards against spurious "## User Guidance" showing up in the analyst prompt.
  it('omits the User Guidance section when no hint is provided', async () => {
    vi.mocked(aiClient).mockResolvedValue('# Tailoring Brief\n...');
    const svc = new TailoringBriefServiceImpl();
    await svc.analyze(POOL, JD, PROFILE, AI);
    const [prompt] = vi.mocked(aiClient).mock.calls[0];
    expect(prompt).not.toContain('## User Guidance');
  });

  // When a hint is given, it lands in the user prompt under User Guidance,
  // labeled authoritative so the analyst knows to prioritize it.
  it('injects the User Guidance section when hint is provided', async () => {
    vi.mocked(aiClient).mockResolvedValue('# Tailoring Brief\n...');
    const svc = new TailoringBriefServiceImpl();
    await svc.analyze(POOL, JD, PROFILE, AI, 'focus on ML ops');
    const [prompt] = vi.mocked(aiClient).mock.calls[0];
    expect(prompt).toContain('## User Guidance');
    expect(prompt).toContain('focus on ML ops');
  });

  // Whitespace-only hint is treated as "no hint" so the prompt stays clean.
  it('treats a whitespace-only hint as no hint', async () => {
    vi.mocked(aiClient).mockResolvedValue('# Brief');
    const svc = new TailoringBriefServiceImpl();
    await svc.analyze(POOL, JD, PROFILE, AI, '   \n  ');
    const [prompt] = vi.mocked(aiClient).mock.calls[0];
    expect(prompt).not.toContain('## User Guidance');
  });

  // Empty AI response must throw so downstream writers don't proceed on garbage.
  it('throws when AI returns an empty brief', async () => {
    vi.mocked(aiClient).mockResolvedValue('');
    const svc = new TailoringBriefServiceImpl();
    await expect(svc.analyze(POOL, JD, PROFILE, AI)).rejects.toThrow('empty brief');
  });
});
