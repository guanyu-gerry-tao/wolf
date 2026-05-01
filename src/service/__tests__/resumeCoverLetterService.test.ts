import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import pino from 'pino';
import { sink } from 'pino-test';
import { ResumeCoverLetterServiceImpl } from '../impl/resumeCoverLetterServiceImpl.js';
import { createSilentLogger, setDefaultLogger } from '../../utils/logger.js';
import type { Profile } from '../../utils/types/index.js';
import type { AiConfig } from '../../utils/types/index.js';

// Mock aiClient so tests never make real API calls.
vi.mock('../../service/ai/index.js', () => ({
  aiClient: vi.fn(),
}));

import { aiClient } from '../../service/ai/index.js';

// Profile is now `{ name, md }`. The service includes profile.md verbatim
// in the prompt; the assertions below check that the candidate's name
// appears in that markdown without depending on field-level access.
const PROFILE: Profile = {
  name: 'default',
  md: `# default

## Identity

### Legal first name
Alex

### Legal last name
Rivera

# Contact

### Email
alex@example.com
`,
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

  // Cover letter: prompt must include brief, JD, and profile. Voice defaults
  // live in the built-in cover-letter protocol prompt, not in wolf.toml.
  it('calls aiClient with prompt containing brief, JD and profile for cover letter', async () => {
    vi.mocked(aiClient).mockResolvedValue('<p>Dear Hiring Manager, I am excited...</p>');
    const svc = new ResumeCoverLetterServiceImpl();
    const result = await svc.generateCoverLetter(RESUME_POOL, JD_TEXT, PROFILE, BRIEF, AI_CONFIG);
    expect(result).toContain('Dear Hiring Manager');
    const [prompt, systemPrompt] = vi.mocked(aiClient).mock.calls[0];
    expect(prompt).toContain(JD_TEXT);
    // The full profile.md is included verbatim — checking for both name halves
    // proves the candidate identity reaches the AI.
    expect(prompt).toContain('Alex');
    expect(prompt).toContain('Rivera');
    expect(prompt).toContain(BRIEF);
    expect(prompt).not.toContain('## Tone');
    expect(systemPrompt).toContain('cover letter');
    expect(systemPrompt).toContain('professional, concise, clear voice');
  });

  it('throws if aiClient returns empty string for cover letter', async () => {
    vi.mocked(aiClient).mockResolvedValue('');
    const svc = new ResumeCoverLetterServiceImpl();
    await expect(
      svc.generateCoverLetter(RESUME_POOL, JD_TEXT, PROFILE, BRIEF, AI_CONFIG),
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
    expect(events[0].profileName).toBe(PROFILE.name);

    expect(events[1].msg).toBe('ai.resume.done');
    expect(events[1].level).toBe(30);
    expect(events[1].profileName).toBe(PROFILE.name);
    // The done event must carry the cost signal (durationMs is a number).
    expect(typeof events[1].durationMs).toBe('number');
  });

  // Bug B3 regression guard. The service is a thin pass-through over aiClient:
  // whatever HTML the writer returns, the service must hand back unchanged.
  // It does NOT inject, normalize, or augment sections. If the model honors
  // the prompt and omits a missing section (e.g. Education for a candidate
  // without a degree), the service must NOT silently re-add it. This guarantee
  // is what lets TAILOR-04's section-honesty contract hold end-to-end:
  // application + service code is a no-op on section structure; the prompt is
  // the only place that decides which sections appear.
  it('returns the writer HTML verbatim when a section is intentionally absent', async () => {
    const poolWithoutEducation = `# EXPERIENCE
SWE at Example Corp (2022-present): backend systems.
# SKILLS
Go, TypeScript`;
    // Writer correctly omits Education because pool has none.
    const htmlWithoutEducation =
      '<h2>EXPERIENCE</h2><div class="item">role bullets</div>' +
      '<h2>SKILLS</h2><div>Go, TypeScript</div>';
    vi.mocked(aiClient).mockResolvedValue(htmlWithoutEducation);

    const svc = new ResumeCoverLetterServiceImpl();
    const result = await svc.tailorResumeToHtml(
      poolWithoutEducation, JD_TEXT, PROFILE, BRIEF, AI_CONFIG,
    );

    // Service hands the model output back unchanged — no Education section
    // is appended, prepended, or otherwise stitched in.
    expect(result).toBe(htmlWithoutEducation);
    expect(result.toLowerCase()).not.toContain('<h2>education');
    expect(result.toLowerCase()).not.toContain('bachelor');
    expect(result.toLowerCase()).not.toContain('b.s.');
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
    expect(errEvent?.profileName).toBe(PROFILE.name);
  });
});
