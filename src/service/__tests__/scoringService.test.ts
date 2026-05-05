import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { ScoringServiceImpl } from '../impl/scoringServiceImpl.js';
import { createSilentLogger, setDefaultLogger } from '../../utils/logger.js';
import { TIER_NAMES } from '../../utils/scoringTiers.js';
import type { BatchService, BatchSubmission } from '../batchService.js';
import type { Job, AiConfig } from '../../utils/types/index.js';

// Mock the AI client at the module level. The scoring service is the only
// place that calls aiClient for the scoring use case, so this single mock
// covers `scoreOne`. Batch submissions go through BatchService instead.
vi.mock('../../service/ai/index.js', () => ({
  aiClient: vi.fn(),
}));

import { aiClient } from '../../service/ai/index.js';

const PROFILE_MD = `# Job Preferences\n\n## Scoring notes\nPrefer remote backend roles. Skip Bay Area onsite.\n\n## Hard reject companies\nPalantir\n\n## Precision-apply companies\nAnthropic\nStripe\n`;
const PROFILE_SCORE_MD = `Long-form scoring guide goes here.\n`;

// Minimal Job fixture — only the fields the prompt builder reads. Shared
// across single + batch tests so prompt-shape assertions can rely on
// known content.
const JOB: Job = {
  id: 'job-1',
  title: 'Backend Engineer',
  companyId: 'company-acme',
  url: 'https://example.com/jobs/1',
  source: 'LinkedIn',
  location: 'Remote (US)',
  remote: true,
  salaryLow: 130000,
  salaryHigh: 180000,
  workAuthorizationRequired: 'no sponsorship',
  clearanceRequired: false,
  score: null,
  scoreJustification: null,
  tierAi: null,
  tierUser: null,
  status: 'new',
  error: null,
  appliedProfileId: null,
  hasTailoredResume: false,
  hasTailoredCoverLetter: false,
  hasScreenshots: false,
  hasOutreachDraft: false,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};
const JD_TEXT = 'We are looking for a backend engineer with Go experience.';
const AI: AiConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };

describe('ScoringServiceImpl.scoreOne', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => setDefaultLogger(createSilentLogger()));

  // Happy path: AI returns a clean tagged response; the service parses it
  // and returns the tier index + assembled markdown comment.
  it('returns tier index and assembled markdown when the AI response is well-formed', async () => {
    vi.mocked(aiClient).mockResolvedValue(
      '<tier>tailor</tier><pros>- Backend Go</pros><cons>- minor stack mismatch</cons>',
    );
    const svc = new ScoringServiceImpl({} as BatchService);
    const result = await svc.scoreOne(JOB, JD_TEXT, PROFILE_MD, PROFILE_SCORE_MD, AI);
    expect(result.tier).toBe(TIER_NAMES.indexOf('tailor'));
    expect(result.comment).toContain('## Tier\ntailor');
    expect(result.comment).toContain('- Backend Go');
    expect(result.comment).toContain('- minor stack mismatch');
  });

  // The user prompt must include the candidate profile (so scoring_notes,
  // hard_reject_companies, and precision_apply_companies all reach the
  // model) AND the JD body. Guards against accidental section drops.
  it('embeds the profile sections and JD body in the user prompt', async () => {
    vi.mocked(aiClient).mockResolvedValue(
      '<tier>mass_apply</tier><pros>- partial fit</pros><cons>- none</cons>',
    );
    const svc = new ScoringServiceImpl({} as BatchService);
    await svc.scoreOne(JOB, JD_TEXT, PROFILE_MD, PROFILE_SCORE_MD, AI);
    const [prompt, systemPrompt] = vi.mocked(aiClient).mock.calls[0]!;
    expect(prompt).toContain('## Candidate Profile');
    expect(prompt).toContain('Skip Bay Area onsite');
    expect(prompt).toContain('Palantir');               // hard_reject_companies
    expect(prompt).toContain('Anthropic');              // precision_apply_companies
    expect(prompt).toContain('## Job Posting');
    expect(prompt).toContain('Backend Engineer');
    expect(prompt).toContain('Go experience');
    // The system prompt names the special signals so the AI is on the same page.
    expect(systemPrompt).toContain('Hard-reject companies');
    expect(systemPrompt).toContain('Precision-apply companies');
  });

  // Manual `wolf add` jobs often do not have structured sponsorship data.
  // Unknown must reach the model as "not listed", not as "no sponsorship",
  // otherwise profiles needing future visa support get false hard rejects.
  it('renders unknown job sponsorship as not listed in the user prompt', async () => {
    vi.mocked(aiClient).mockResolvedValue(
      '<tier>mass_apply</tier><pros>- backend role</pros><cons>- sponsorship not listed</cons>',
    );
    const svc = new ScoringServiceImpl({} as BatchService);
    await svc.scoreOne(
      { ...JOB, workAuthorizationRequired: 'unknown' },
      JD_TEXT,
      PROFILE_MD,
      PROFILE_SCORE_MD,
      AI,
    );
    const [prompt] = vi.mocked(aiClient).mock.calls[0]!;
    expect(prompt).toContain('Sponsorship: not listed');
    expect(prompt).not.toContain('Sponsorship: no sponsorship');
  });

  // The profile-level scoring guide is included as its own section so the
  // model can prioritize user-authored steering over generic heuristics.
  it('includes the profile-level scoring guide section when score.md has content', async () => {
    vi.mocked(aiClient).mockResolvedValue(
      '<tier>skip</tier><pros>- none</pros><cons>- mismatch</cons>',
    );
    const svc = new ScoringServiceImpl({} as BatchService);
    await svc.scoreOne(JOB, JD_TEXT, PROFILE_MD, 'Reject anything below $150k.', AI);
    const [prompt] = vi.mocked(aiClient).mock.calls[0]!;
    expect(prompt).toContain('## Profile-level scoring guide');
    expect(prompt).toContain('Reject anything below');
  });

  // An empty score.md (or one stripped down to just the > [!TODO] header)
  // should not produce an empty `## Profile-level scoring guide` section
  // in the prompt — that would confuse the AI.
  it('omits the profile-level scoring guide section when score.md is empty', async () => {
    vi.mocked(aiClient).mockResolvedValue(
      '<tier>skip</tier><pros>- none</pros><cons>- mismatch</cons>',
    );
    const svc = new ScoringServiceImpl({} as BatchService);
    await svc.scoreOne(JOB, JD_TEXT, PROFILE_MD, '', AI);
    const [prompt] = vi.mocked(aiClient).mock.calls[0]!;
    expect(prompt).not.toContain('## Profile-level scoring guide');
  });

  // The provider/model in AiConfig must reach the AI dispatcher unchanged
  // so users can pin score.model in wolf.toml or override via --ai-model.
  it('forwards provider and model to aiClient', async () => {
    vi.mocked(aiClient).mockResolvedValue(
      '<tier>skip</tier><pros>- none</pros><cons>- mismatch</cons>',
    );
    const svc = new ScoringServiceImpl({} as BatchService);
    await svc.scoreOne(JOB, JD_TEXT, PROFILE_MD, PROFILE_SCORE_MD, {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
    });
    const args = vi.mocked(aiClient).mock.calls[0]![2]!;
    expect(args).toEqual({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001' });
  });

  // Malformed AI output is the parser's responsibility to flag, but the
  // service must surface that as a thrown error (no silent default tier).
  it('throws when the AI response cannot be parsed', async () => {
    vi.mocked(aiClient).mockResolvedValue('I cannot help with that.');
    const svc = new ScoringServiceImpl({} as BatchService);
    await expect(
      svc.scoreOne(JOB, JD_TEXT, PROFILE_MD, PROFILE_SCORE_MD, AI),
    ).rejects.toThrow(/parse/i);
  });
});

describe('ScoringServiceImpl.submitBatch', () => {
  beforeEach(() => vi.clearAllMocks());

  // Building one BatchAiCallRequest per job — customId must be the job id
  // so pollers can match results back to rows. Each request carries the
  // score-system prompt so the provider can score items independently.
  it('builds one request per job with customId = job.id and the score-system prompt', async () => {
    const submitAiBatch = vi.fn().mockResolvedValue({
      id: 'batch-uuid-1',
      batchId: 'msgbatch_xyz',
      provider: 'anthropic',
      type: 'score',
      model: 'claude-sonnet-4-6',
      submitted: 2,
    } satisfies BatchSubmission);
    const batchService = { submitAiBatch } as unknown as BatchService;
    const svc = new ScoringServiceImpl(batchService);

    const jobs = [
      { job: JOB, jdText: JD_TEXT },
      { job: { ...JOB, id: 'job-2', title: 'Senior Backend' }, jdText: 'Different JD' },
    ];
    const result = await svc.submitBatch(jobs, PROFILE_MD, PROFILE_SCORE_MD, 'default', AI);

    expect(result).toEqual({ batchId: 'batch-uuid-1', submitted: 2 });
    expect(submitAiBatch).toHaveBeenCalledTimes(1);
    const [requests, options] = submitAiBatch.mock.calls[0]!;
    expect(requests).toHaveLength(2);
    expect(requests[0].customId).toBe('job-1');
    expect(requests[1].customId).toBe('job-2');
    expect(requests[0].prompt).toContain('Backend Engineer');
    expect(requests[1].prompt).toContain('Senior Backend');
    expect(requests[0].systemPrompt).toContain('job-fit triager');
    expect(options).toEqual({
      type: 'score',
      profileId: 'default',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
  });

  it('rejects an empty job list', async () => {
    const svc = new ScoringServiceImpl({} as BatchService);
    await expect(
      svc.submitBatch([], PROFILE_MD, PROFILE_SCORE_MD, 'default', AI),
    ).rejects.toThrow(/no jobs/i);
  });

  // Today only Anthropic batches are wired. If a user pins a non-batch-able
  // provider via --ai-model, fail fast with a hint pointing at --single.
  it('rejects providers that lack a batch adapter', async () => {
    const svc = new ScoringServiceImpl({} as BatchService);
    const jobs = [{ job: JOB, jdText: JD_TEXT }];
    await expect(
      svc.submitBatch(jobs, PROFILE_MD, PROFILE_SCORE_MD, 'default', {
        provider: 'openrouter' as unknown as 'anthropic',
        model: 'x',
      }),
    ).rejects.toThrow(/--single/i);
  });
});
