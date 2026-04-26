import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import pino from 'pino';
import { sink } from 'pino-test';
import { TailoringBriefServiceImpl } from '../impl/tailoringBriefServiceImpl.js';
import { createSilentLogger, setDefaultLogger } from '../../utils/logger.js';
import type { UserProfile, AiConfig } from '../../types/index.js';

// Mock aiClient so tests never touch the network.
vi.mock('../../utils/ai/index.js', () => ({
  aiClient: vi.fn(),
}));

import { aiClient } from '../../utils/ai/index.js';

const PROFILE: UserProfile = {
  id: 'default', label: 'Default',
  legalFirstName: 'Alex', legalMiddleName: null, legalLastName: 'Rivera',
  preferredName: null, pronouns: null,
  email: 'alex@example.com',
  phone: '+1 555 000 0000', firstUrl: null, secondUrl: null, thirdUrl: null,
  immigrationStatus: 'no limit', willingToRelocate: 'no',
  targetRoles: ['SWE'], targetLocations: ['Remote'], scoringNotes: null,
};
const POOL = '# EXPERIENCE\nSenior SWE at Acme (2022-present)';
const JD = 'Looking for backend engineer with Go experience';
const AI: AiConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };

describe('TailoringBriefService', () => {
  beforeEach(() => vi.clearAllMocks());
  // Restore silent default after each test — the event-capture test below
  // installs a memory-sink logger and without this afterEach, later tests
  // in this file would inherit it. Vitest file-level isolation means
  // unrelated test files need no logger setup at all.
  afterEach(() => setDefaultLogger(createSilentLogger()));

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

  // Logger retrofit — error-path capture. Proves that an empty brief from
  // the AI produces a structured error event BEFORE the thrown exception
  // bubbles out. This is the breadcrumb that lets us diagnose recurring
  // failures from data/logs/wolf.log.jsonl without re-running the pipeline.
  it('emits ai.brief.empty_response before rethrowing on empty AI output', async () => {
    vi.mocked(aiClient).mockResolvedValue('');

    // Install a pino-test sink and collect emitted events so we can find
    // the error event by msg rather than by position (start/done fire
    // first, then the error during validation).
    const stream = sink();
    setDefaultLogger(pino({ level: 'debug' }, stream));
    const events: Record<string, unknown>[] = [];
    stream.on('data', (line) => events.push(line));

    const svc = new TailoringBriefServiceImpl();
    await expect(svc.analyze(POOL, JD, PROFILE, AI)).rejects.toThrow('empty brief');

    // Find the error event by message, assert its shape.
    const errEvent = events.find((e) => e.msg === 'ai.brief.empty_response');
    expect(errEvent).toBeDefined();
    expect(errEvent?.level).toBe(50); // pino numeric for `error`
    expect(errEvent?.profileId).toBe(PROFILE.id);
  });
});
