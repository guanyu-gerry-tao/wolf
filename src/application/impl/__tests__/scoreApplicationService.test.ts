import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { ScoreApplicationServiceImpl } from '../scoreApplicationServiceImpl.js';
import { SqliteBatchRepositoryImpl } from '../../../repository/impl/sqliteBatchRepositoryImpl.js';
import { SqliteBatchItemRepositoryImpl } from '../../../repository/impl/sqliteBatchItemRepositoryImpl.js';
import { initializeSchema } from '../../../repository/impl/initializeSchema.js';
import { createSilentLogger, setDefaultLogger } from '../../../utils/logger.js';
import { TIER_NAMES, type TierIndex } from '../../../utils/scoringTiers.js';
import type { JobRepository } from '../../../repository/jobRepository.js';
import type { ProfileRepository } from '../../../repository/profileRepository.js';
import type { BatchService } from '../../../service/batchService.js';
import type { ScoringService } from '../../../service/scoringService.js';
import type { Job, AiConfig } from '../../../utils/types/index.js';

// Build a Job with sensible defaults; tests override specific fields via spread.
// Centralized so multiple cases share a baseline shape and assertions stay tight.
function makeJob(overrides: Partial<Job> = {}): Job {
  return {
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
    ...overrides,
  };
}

// Test-only JobRepository that holds rows in a Map. The application service
// only depends on a small slice of JobRepository, so the rest are stubbed
// to throw — calling an unwired method is a test bug.
class FakeJobRepository implements JobRepository {
  private rows = new Map<string, Job>();
  private jdTexts = new Map<string, string>();

  seed(job: Job, jdText = 'JD body'): void {
    this.rows.set(job.id, { ...job });
    this.jdTexts.set(job.id, jdText);
  }

  async get(id: string): Promise<Job | null> {
    return this.rows.get(id) ?? null;
  }
  async query(): Promise<Job[]> {
    return [...this.rows.values()];
  }
  async update(id: string, patch: Partial<Job>): Promise<void> {
    const current = this.rows.get(id);
    if (!current) throw new Error(`FakeJobRepository: missing job ${id}`);
    this.rows.set(id, {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }
  async readJdText(id: string): Promise<string> {
    const text = this.jdTexts.get(id);
    if (text === undefined) throw new Error(`FakeJobRepository: missing jd for ${id}`);
    return text;
  }
  // Methods the application service does not exercise — stubbed so contract drift fails loudly.
  save = async (): Promise<void> => { throw new Error('not used'); };
  saveMany = async (): Promise<void> => { throw new Error('not used'); };
  updateMany = async (): Promise<void> => { throw new Error('not used'); };
  countByStatus = async (): Promise<never> => { throw new Error('not used'); };
  countAll = async (): Promise<number> => 0;
  countWithTailoredResume = async (): Promise<number> => 0;
  countWithoutCompleteTailor = async (): Promise<number> => 0;
  countMatching = async (): Promise<number> => 0;
  delete = async (): Promise<void> => { throw new Error('not used'); };
  getWorkspaceDir = async (): Promise<string> => '/tmp/wolf-test';
  writeJdText = async (): Promise<void> => { throw new Error('not used'); };
  getArtifactPath = async (): Promise<string> => { throw new Error('not used'); };
}

// Minimal ProfileRepository — only getProfileMd and getScoreMd are read.
class FakeProfileRepository implements ProfileRepository {
  constructor(
    private readonly profiles: Record<string, string>,
    private readonly scoreMds: Record<string, string> = {},
  ) {}
  async getProfileMd(name: string): Promise<string> {
    if (!(name in this.profiles)) throw new Error(`profile not found: ${name}`);
    return this.profiles[name]!;
  }
  async getScoreMd(name: string): Promise<string> {
    return this.scoreMds[name] ?? '';
  }
  async writeScoreMd(): Promise<void> { /* unused */ }
  async ensureScoreMd(): Promise<void> { /* unused */ }
  // Methods the application service does not exercise.
  get = async (): Promise<never> => { throw new Error('not used'); };
  getDefault = async (): Promise<never> => { throw new Error('not used'); };
  list = async (): Promise<string[]> => Object.keys(this.profiles);
  getProfileToml = async (): Promise<never> => { throw new Error('not used'); };
  getResumePool = async (): Promise<string> => '';
  getStandardQuestions = async (): Promise<string> => '';
  getAttachmentsList = async (): Promise<string[]> => [];
}

const AI_CONFIG: AiConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };
const PROFILE_MD = '# Job Preferences\n\n## Scoring notes\nPrefer remote backend roles.';

function makeRepos() {
  const sqlite = new BetterSqlite3(':memory:');
  const db = drizzle(sqlite);
  initializeSchema(db);
  return {
    batchRepo: new SqliteBatchRepositoryImpl(db),
    batchItemRepo: new SqliteBatchItemRepositoryImpl(db),
  };
}

const TAILOR: TierIndex = TIER_NAMES.indexOf('tailor') as TierIndex;
const SKIP: TierIndex = TIER_NAMES.indexOf('skip') as TierIndex;

describe('ScoreApplicationServiceImpl (v3 tier model)', () => {
  beforeEach(() => {
    process.env.WOLF_ANTHROPIC_API_KEY = 'test-key';
  });
  afterEach(() => setDefaultLogger(createSilentLogger()));

  // The default mode submits all `tierAi: null` jobs through ScoringService.submitBatch.
  // Already-scored jobs are excluded so re-running `wolf score` is idempotent.
  it('default mode submits every unscored (tierAi: null) job to the batch service', async () => {
    const jobRepo = new FakeJobRepository();
    jobRepo.seed(makeJob({ id: 'job-1' }), 'JD-1');
    jobRepo.seed(makeJob({ id: 'job-2', title: 'Senior BE' }), 'JD-2');
    jobRepo.seed(makeJob({ id: 'job-3', tierAi: TAILOR }), 'JD-3');
    const profileRepo = new FakeProfileRepository({ default: PROFILE_MD });
    const { batchRepo, batchItemRepo } = makeRepos();
    const submitBatch = vi.fn().mockResolvedValue({ batchId: 'b-1', submitted: 2 });
    const scoring: ScoringService = { submitBatch, scoreOne: vi.fn() };
    const svc = new ScoreApplicationServiceImpl(
      jobRepo, profileRepo, batchRepo, batchItemRepo, {} as BatchService, scoring, AI_CONFIG, 'default',
    );

    const result = await svc.score({});

    expect(result).toEqual({ submitted: 2 });
    expect(submitBatch).toHaveBeenCalledTimes(1);
    const [jobsArg, profileArg, scoreMdArg, profileIdArg, aiArg] = submitBatch.mock.calls[0]!;
    expect(jobsArg.map((j: { job: Job }) => j.job.id).sort()).toEqual(['job-1', 'job-2']);
    expect(profileArg).toBe(PROFILE_MD);
    expect(scoreMdArg).toBe('');
    expect(profileIdArg).toBe('default');
    expect(aiArg).toEqual(AI_CONFIG);
  });

  // --job-ids takes those exact ids regardless of current tierAi state, so
  // the user can ask for a re-score on demand.
  it('default mode honors --job-ids exactly (re-scoring is allowed)', async () => {
    const jobRepo = new FakeJobRepository();
    jobRepo.seed(makeJob({ id: 'job-1', tierAi: SKIP }), 'JD-1');
    jobRepo.seed(makeJob({ id: 'job-2' }), 'JD-2');
    const profileRepo = new FakeProfileRepository({ default: PROFILE_MD });
    const { batchRepo, batchItemRepo } = makeRepos();
    const submitBatch = vi.fn().mockResolvedValue({ batchId: 'b', submitted: 1 });
    const scoring: ScoringService = { submitBatch, scoreOne: vi.fn() };
    const svc = new ScoreApplicationServiceImpl(
      jobRepo, profileRepo, batchRepo, batchItemRepo, {} as BatchService, scoring, AI_CONFIG, 'default',
    );

    const result = await svc.score({ jobIds: ['job-1'] });

    expect(result).toEqual({ submitted: 1 });
    const [jobsArg] = submitBatch.mock.calls[0]!;
    expect(jobsArg.map((j: { job: Job }) => j.job.id)).toEqual(['job-1']);
  });

  // --single calls scoreOne, persists the tier + comment, and echoes them
  // back so AI orchestrators can present inline.
  it('--single scores one job synchronously and writes tier_ai + scoreJustification', async () => {
    const jobRepo = new FakeJobRepository();
    jobRepo.seed(makeJob({ id: 'job-1' }), 'JD-1');
    const profileRepo = new FakeProfileRepository(
      { default: PROFILE_MD },
      { default: 'Long-form scoring guide.' },
    );
    const { batchRepo, batchItemRepo } = makeRepos();
    const scoreOne = vi.fn().mockResolvedValue({
      tier: TAILOR,
      comment: '## Tier\ntailor\n\n## Pros\n- backend Go\n\n## Cons\n- onsite\n',
    });
    const scoring: ScoringService = { submitBatch: vi.fn(), scoreOne };
    const svc = new ScoreApplicationServiceImpl(
      jobRepo, profileRepo, batchRepo, batchItemRepo, {} as BatchService, scoring, AI_CONFIG, 'default',
    );

    const result = await svc.score({ single: true });

    expect(result).toEqual({
      submitted: 1,
      singleTier: TAILOR,
      singleTierName: 'tailor',
      singleMd: '## Tier\ntailor\n\n## Pros\n- backend Go\n\n## Cons\n- onsite\n',
    });
    const updated = await jobRepo.get('job-1');
    expect(updated?.tierAi).toBe(TAILOR);
    expect(updated?.scoreJustification).toContain('## Tier\ntailor');
    // tierUser must remain null — AI never writes it.
    expect(updated?.tierUser).toBeNull();
    // The score.md content must reach scoreOne's profileScoreMd argument.
    const args = scoreOne.mock.calls[0]!;
    expect(args[3]).toBe('Long-form scoring guide.');
  });

  // No candidate to score is a user-visible error so they can re-run after
  // hunting more jobs (instead of a silent no-op).
  it('--single throws when no candidate jobs exist', async () => {
    const jobRepo = new FakeJobRepository();
    const profileRepo = new FakeProfileRepository({ default: PROFILE_MD });
    const { batchRepo, batchItemRepo } = makeRepos();
    const scoring: ScoringService = { submitBatch: vi.fn(), scoreOne: vi.fn() };
    const svc = new ScoreApplicationServiceImpl(
      jobRepo, profileRepo, batchRepo, batchItemRepo, {} as BatchService, scoring, AI_CONFIG, 'default',
    );

    await expect(svc.score({ single: true })).rejects.toThrow(/no candidate/i);
  });

  // --ai-model overrides the default AI config so users can pin Haiku for
  // cheap scoring without editing wolf.toml.
  it('--ai-model overrides the default AI config', async () => {
    const jobRepo = new FakeJobRepository();
    jobRepo.seed(makeJob({ id: 'job-1' }), 'JD-1');
    const profileRepo = new FakeProfileRepository({ default: PROFILE_MD });
    const { batchRepo, batchItemRepo } = makeRepos();
    const scoreOne = vi.fn().mockResolvedValue({
      tier: SKIP,
      comment: '## Tier\nskip\n\n## Pros\n-\n\n## Cons\n- mismatch\n',
    });
    const scoring: ScoringService = { submitBatch: vi.fn(), scoreOne };
    const svc = new ScoreApplicationServiceImpl(
      jobRepo, profileRepo, batchRepo, batchItemRepo, {} as BatchService, scoring, AI_CONFIG, 'default',
    );

    await svc.score({ single: true, aiModel: 'anthropic/claude-haiku-4-5-20251001' });

    const args = scoreOne.mock.calls[0]!;
    expect(args[4]).toEqual({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001' });
  });

  // Missing API key surfaces as MissingApiKeyError before any AI call.
  it('throws MissingApiKeyError when WOLF_ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.WOLF_ANTHROPIC_API_KEY;
    const jobRepo = new FakeJobRepository();
    jobRepo.seed(makeJob({ id: 'job-1' }), 'JD-1');
    const profileRepo = new FakeProfileRepository({ default: PROFILE_MD });
    const { batchRepo, batchItemRepo } = makeRepos();
    const scoring: ScoringService = { submitBatch: vi.fn(), scoreOne: vi.fn() };
    const svc = new ScoreApplicationServiceImpl(
      jobRepo, profileRepo, batchRepo, batchItemRepo, {} as BatchService, scoring, AI_CONFIG, 'default',
    );

    await expect(svc.score({ single: true })).rejects.toThrow(/WOLF_ANTHROPIC_API_KEY/);
  });

  // --poll drains the provider, walks completed score batches, parses each
  // succeeded item, and writes tierAi + scoreJustification back to the Job
  // row. Items are marked consumed so a second --poll is a no-op. tier_user
  // is left untouched.
  it('--poll applies completed score-batch items back to Job rows and is idempotent', async () => {
    const jobRepo = new FakeJobRepository();
    jobRepo.seed(makeJob({ id: 'job-1' }));
    jobRepo.seed(makeJob({ id: 'job-2', tierUser: SKIP }));   // user override stays
    const profileRepo = new FakeProfileRepository({ default: PROFILE_MD });
    const { batchRepo, batchItemRepo } = makeRepos();
    const pollAiBatches = vi.fn().mockResolvedValue({
      polled: 1, completed: 1, failed: 0, itemsSucceeded: 2, itemsFailed: 0,
    });
    const batchService = { pollAiBatches } as unknown as BatchService;
    const scoring: ScoringService = { submitBatch: vi.fn(), scoreOne: vi.fn() };

    const submittedAt = new Date().toISOString();
    await batchRepo.save({
      id: 'batch-uuid', batchId: 'msgbatch_x', type: 'score', aiProvider: 'anthropic',
      model: 'claude-sonnet-4-6', profileId: 'default', status: 'completed',
      errorMessage: null, submittedAt, completedAt: submittedAt,
    });
    await batchItemRepo.saveMany([
      {
        id: 'item-1', batchId: 'batch-uuid', customId: 'job-1', status: 'succeeded',
        resultText: '<tier>tailor</tier><pros>- ok</pros><cons>- minor mismatch</cons>',
        errorMessage: null, consumedAt: null, createdAt: submittedAt, completedAt: submittedAt,
      },
      {
        id: 'item-2', batchId: 'batch-uuid', customId: 'job-2', status: 'succeeded',
        resultText: '<tier>skip</tier><pros>- minimal pros</pros><cons>- bad fit</cons>',
        errorMessage: null, consumedAt: null, createdAt: submittedAt, completedAt: submittedAt,
      },
    ]);

    const svc = new ScoreApplicationServiceImpl(
      jobRepo, profileRepo, batchRepo, batchItemRepo, batchService, scoring, AI_CONFIG, 'default',
    );
    const result = await svc.score({ poll: true });

    expect(pollAiBatches).toHaveBeenCalledOnce();
    expect(result).toEqual({ submitted: 0, polled: 1 });
    const j1 = await jobRepo.get('job-1');
    const j2 = await jobRepo.get('job-2');
    expect(j1?.tierAi).toBe(TAILOR);
    expect(j1?.scoreJustification).toContain('## Tier\ntailor');
    expect(j2?.tierAi).toBe(SKIP);
    // User override on job-2 is untouched even though tierAi just changed.
    expect(j2?.tierUser).toBe(SKIP);

    // Second poll must be a no-op for already-applied items.
    const items = await batchItemRepo.listByBatch('batch-uuid');
    expect(items.every((i) => i.consumedAt !== null)).toBe(true);

    await jobRepo.update('job-1', { tierAi: null, scoreJustification: null });
    await svc.score({ poll: true });
    const j1AfterSecondPoll = await jobRepo.get('job-1');
    expect(j1AfterSecondPoll?.tierAi).toBeNull();
  });

  // Malformed AI output flips the Job to status='error' so `wolf job list
  // --status error` surfaces it. The item is still marked consumed so we
  // don't loop forever.
  it('--poll marks Job as score_error when the AI output cannot be parsed', async () => {
    const jobRepo = new FakeJobRepository();
    jobRepo.seed(makeJob({ id: 'job-1' }));
    const profileRepo = new FakeProfileRepository({ default: PROFILE_MD });
    const { batchRepo, batchItemRepo } = makeRepos();
    const batchService = { pollAiBatches: vi.fn().mockResolvedValue({}) } as unknown as BatchService;
    const scoring: ScoringService = { submitBatch: vi.fn(), scoreOne: vi.fn() };
    const submittedAt = new Date().toISOString();
    await batchRepo.save({
      id: 'batch-uuid', batchId: 'msgbatch_x', type: 'score', aiProvider: 'anthropic',
      model: 'claude-sonnet-4-6', profileId: 'default', status: 'completed',
      errorMessage: null, submittedAt, completedAt: submittedAt,
    });
    await batchItemRepo.saveMany([{
      id: 'item-1', batchId: 'batch-uuid', customId: 'job-1', status: 'succeeded',
      resultText: 'I cannot help with that.', errorMessage: null,
      consumedAt: null, createdAt: submittedAt, completedAt: submittedAt,
    }]);

    const svc = new ScoreApplicationServiceImpl(
      jobRepo, profileRepo, batchRepo, batchItemRepo, batchService, scoring, AI_CONFIG, 'default',
    );
    await svc.score({ poll: true });

    const j1 = await jobRepo.get('job-1');
    expect(j1?.status).toBe('error');
    expect(j1?.error).toBe('score_error');
    expect(j1?.tierAi).toBeNull();
  });

  // Provider-side failures (errored / canceled / expired item status) also
  // flip the Job to score_error so the user can re-run hunt or score later.
  it('--poll marks Job as score_error when the provider reports an item failure', async () => {
    const jobRepo = new FakeJobRepository();
    jobRepo.seed(makeJob({ id: 'job-1' }));
    const profileRepo = new FakeProfileRepository({ default: PROFILE_MD });
    const { batchRepo, batchItemRepo } = makeRepos();
    const batchService = { pollAiBatches: vi.fn().mockResolvedValue({}) } as unknown as BatchService;
    const scoring: ScoringService = { submitBatch: vi.fn(), scoreOne: vi.fn() };
    const submittedAt = new Date().toISOString();
    await batchRepo.save({
      id: 'batch-uuid', batchId: 'msgbatch_x', type: 'score', aiProvider: 'anthropic',
      model: 'claude-sonnet-4-6', profileId: 'default', status: 'completed',
      errorMessage: null, submittedAt, completedAt: submittedAt,
    });
    await batchItemRepo.saveMany([{
      id: 'item-1', batchId: 'batch-uuid', customId: 'job-1', status: 'errored',
      resultText: null, errorMessage: 'rate limited',
      consumedAt: null, createdAt: submittedAt, completedAt: submittedAt,
    }]);

    const svc = new ScoreApplicationServiceImpl(
      jobRepo, profileRepo, batchRepo, batchItemRepo, batchService, scoring, AI_CONFIG, 'default',
    );
    await svc.score({ poll: true });

    const j1 = await jobRepo.get('job-1');
    expect(j1?.status).toBe('error');
    expect(j1?.error).toBe('score_error');
  });
});
