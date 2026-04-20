import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import pino from 'pino';
import { sink } from 'pino-test';
import { ResumeCoverLetterServiceImpl } from '../impl/resumeCoverLetterServiceImpl.js';
import { createSilentLogger, setDefaultLogger } from '../../utils/logger.js';
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
  // Restore the silent default after each test because the event-capture
  // tests below install a memory-sink logger. Without this, later tests
  // in this file would inherit the memory sink. Vitest isolates module
  // state per FILE (isolate: true by default), so unrelated test files
  // don't need any logger setup at all.
  afterEach(() => setDefaultLogger(createSilentLogger()));

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

  // ---------------------------------------------------------------------------
  // Logger retrofit — prove state transitions and errors are logged.
  // Uses pino-test's `sink()` + a local 'data' listener to capture emitted
  // events as parsed objects. Failure paths are the most valuable signals;
  // they leave post-hoc breadcrumbs in data/logs/wolf.log.jsonl.
  // ---------------------------------------------------------------------------

  // Helper: install a pino sink and start collecting emitted events into an
  // array so each test can assert on them after the service call returns.
  function installCapture(): Record<string, unknown>[] {
    const stream = sink();
    setDefaultLogger(pino({ level: 'debug' }, stream));
    const events: Record<string, unknown>[] = [];
    stream.on('data', (line) => events.push(line));
    return events;
  }

  it('emits ai.resume.start and ai.resume.done on the happy path', async () => {
    vi.mocked(aiClient).mockResolvedValue('<h2>EXPERIENCE</h2>');
    const events = installCapture();

    const svc = new ResumeCoverLetterServiceImpl();
    await svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE, BRIEF, AI_CONFIG);

    // Two events emitted: ai.resume.start (debug) then ai.resume.done (info).
    // pino levels: debug=20, info=30.
    expect(events).toHaveLength(2);
    expect(events[0].msg).toBe('ai.resume.start');
    expect(events[0].level).toBe(20);
    expect(events[0].profileId).toBe(PROFILE.id);

    expect(events[1].msg).toBe('ai.resume.done');
    expect(events[1].level).toBe(30);
    expect(events[1].profileId).toBe(PROFILE.id);
    // The done event must carry the cost signal (durationMs is a number).
    expect(typeof events[1].durationMs).toBe('number');
  });

  it('emits ai.resume.empty_response before rethrowing on empty AI output', async () => {
    vi.mocked(aiClient).mockResolvedValue('');
    const events = installCapture();

    const svc = new ResumeCoverLetterServiceImpl();
    await expect(svc.tailorResumeToHtml(RESUME_POOL, JD_TEXT, PROFILE, BRIEF, AI_CONFIG))
      .rejects.toThrow('empty');

    // Three events: start, done (even for empty response — validation
    // happens after the AI call returns), then the error before the throw.
    const errEvent = events.find((e) => e.msg === 'ai.resume.empty_response');
    expect(errEvent).toBeDefined();
    expect(errEvent?.level).toBe(50); // pino numeric for `error`
    expect(errEvent?.profileId).toBe(PROFILE.id);
  });
});
