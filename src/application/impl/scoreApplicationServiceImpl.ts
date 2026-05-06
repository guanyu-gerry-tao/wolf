import { parseModelRef } from '../../utils/parseModelRef.js';
import { assertApiKey } from '../../utils/apiKeyGuard.js';
import { isDevBuild } from '../../utils/instance.js';
import { log } from '../../utils/logger.js';
import { parseScoreResponse } from '../../service/impl/scoringServiceImpl.js';
import { TIER_NAMES } from '../../utils/scoringTiers.js';
import type { ScoreApplicationService } from '../scoreApplicationService.js';
import type {
  ScoreOptions,
  ScoreResult,
  Job,
  AiConfig,
} from '../../utils/types/index.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type { BatchRepository } from '../../repository/batchRepository.js';
import type { BatchItemRepository } from '../../repository/batchItemRepository.js';
import type { BatchService } from '../../service/batchService.js';
import type { ScoringService } from '../../service/scoringService.js';

/**
 * Default `ScoreApplicationService` impl (v3 — tier-based).
 *
 * Three execution paths, dispatched on `ScoreOptions`:
 *
 *   - `poll`   drains the provider's pending batches via
 *              `BatchService.pollAiBatches`, then walks every completed
 *              score batch and writes unconsumed items back to the
 *              corresponding `Job.tierAi` + `Job.scoreJustification`.
 *              Idempotent — already-consumed items are skipped.
 *   - `single` calls `ScoringService.scoreOne` synchronously, writes
 *              the result back, and returns `singleTier` / `singleTierName` /
 *              `singleMd` for inline AI-orchestrator presentation.
 *   - default  enqueues every `tierAi: null` candidate (or the explicit
 *              `jobIds`) into the Anthropic Batch API via
 *              `ScoringService.submitBatch`.
 *
 * AI paths only ever write `Job.tierAi`. User overrides live on
 * `Job.tierUser` and are set via `wolf job set tier ...`; this service
 * never overwrites them. The effective tier (consumed by tailor / fill /
 * job list) is `tierUser ?? tierAi`.
 */
export class ScoreApplicationServiceImpl implements ScoreApplicationService {
  constructor(
    private readonly jobRepo: JobRepository,
    private readonly profileRepo: ProfileRepository,
    private readonly batchRepo: BatchRepository,
    private readonly batchItemRepo: BatchItemRepository,
    private readonly batchService: BatchService,
    private readonly scoring: ScoringService,
    private readonly defaultAiConfig: AiConfig,
    private readonly defaultProfileId: string,
  ) {}

  /** @inheritdoc */
  async score(options: ScoreOptions): Promise<ScoreResult> {
    if (options.poll) return this.handlePoll();

    const profileId = options.profileId ?? this.defaultProfileId;
    const profileMd = await this.profileRepo.getProfileMd(profileId);
    const profileScoreMd = await this.profileRepo.getScoreMd(profileId);
    const aiConfig = options.aiModel
      ? parseModelRef(options.aiModel)
      : this.defaultAiConfig;
    // Fail fast before any AI / batch call so the user sees a clear setup error
    // rather than an opaque 401 from deep inside the SDK. Skip the guard when
    // the dev-only test-stub hook is active (`WOLF_TEST_AI_RESPONSE_FILE` in a
    // dev build) — the AI dispatcher short-circuits before any network call,
    // so requiring an API key in that path is just ceremony that breaks AC
    // tests. Stable user builds ignore `WOLF_TEST_AI_RESPONSE_FILE`, so this
    // bypass cannot be triggered in production.
    const testStubActive = isDevBuild() && Boolean(process.env.WOLF_TEST_AI_RESPONSE_FILE);
    if (!testStubActive) {
      assertApiKey('ANTHROPIC_API_KEY');
    }

    if (options.single) {
      return this.handleSingle(options, profileMd, profileScoreMd, aiConfig);
    }
    return this.handleBatch(options, profileMd, profileScoreMd, profileId, aiConfig);
  }

  private async handlePoll(): Promise<ScoreResult> {
    // 1. Drain pending provider batches — pollAiBatches updates batches/items rows
    //    in place. We don't need its summary; we drive the apply loop ourselves
    //    so leftover items from prior poll runs are also flushed.
    await this.batchService.pollAiBatches();

    // 2. Walk every completed score batch (including ones completed before this
    //    invocation) and apply unconsumed items back to the Job rows.
    const completed = await this.batchRepo.listCompletedByType('score');
    const polled = completed.length;
    for (const batch of completed) {
      const items = await this.batchItemRepo.listByBatch(batch.id);
      for (const item of items) {
        if (item.consumedAt) continue;
        if (item.status === 'succeeded' && item.resultText) {
          const parsed = parseScoreResponse(item.resultText);
          if (parsed.ok) {
            await this.jobRepo.update(item.customId, {
              tierAi: parsed.value.tier,
              scoreJustification: parsed.value.comment,
            });
          } else {
            log.warn('score.poll.parse_error', {
              jobId: item.customId,
              batchId: batch.id,
              error: parsed.error,
            });
            await this.jobRepo.update(item.customId, {
              status: 'error',
              error: 'score_error',
            });
          }
        } else if (item.status !== 'pending') {
          // Provider failed/canceled/expired this item — surface as a Job-level
          // error so `wolf job list --status error` catches it.
          log.warn('score.poll.item_failed', {
            jobId: item.customId,
            batchId: batch.id,
            status: item.status,
            errorMessage: item.errorMessage,
          });
          await this.jobRepo.update(item.customId, {
            status: 'error',
            error: 'score_error',
          });
        }
        await this.batchItemRepo.markConsumed(item.id, new Date().toISOString());
      }
    }
    return { submitted: 0, polled };
  }

  private async handleSingle(
    options: ScoreOptions,
    profileMd: string,
    profileScoreMd: string,
    aiConfig: AiConfig,
  ): Promise<ScoreResult> {
    const target = await this.loadOneCandidate(options);
    if (!target) {
      throw new Error('wolf score --single: no candidate jobs to score (queue empty or all already scored)');
    }
    const jdText = await this.jobRepo.readJdText(target.id);
    const outcome = await this.scoring.scoreOne(target, jdText, profileMd, profileScoreMd, aiConfig);
    await this.jobRepo.update(target.id, {
      tierAi: outcome.tier,
      scoreJustification: outcome.comment,
    });
    return {
      submitted: 1,
      singleTier: outcome.tier,
      singleTierName: TIER_NAMES[outcome.tier],
      singleMd: outcome.comment,
    };
  }

  private async handleBatch(
    options: ScoreOptions,
    profileMd: string,
    profileScoreMd: string,
    profileId: string,
    aiConfig: AiConfig,
  ): Promise<ScoreResult> {
    const candidates = await this.loadCandidates(options);
    if (candidates.length === 0) {
      return { submitted: 0 };
    }
    const jobs = await Promise.all(
      candidates.map(async (job) => ({
        job,
        jdText: await this.jobRepo.readJdText(job.id),
      })),
    );
    const submission = await this.scoring.submitBatch(jobs, profileMd, profileScoreMd, profileId, aiConfig);
    return { submitted: submission.submitted };
  }

  // Resolve the candidate set. Explicit --job-ids ALWAYS wins (even if a job
  // already has a tier_ai — re-scoring on demand is a valid use case). The
  // default path picks every job whose tierAi is still null. tierUser is
  // never used as a filter — AI paths run regardless of user overrides; the
  // override sticks because AI never writes tierUser.
  private async loadCandidates(options: ScoreOptions): Promise<Job[]> {
    if (options.jobIds && options.jobIds.length > 0) {
      const jobs: Job[] = [];
      for (const id of options.jobIds) {
        const job = await this.jobRepo.get(id);
        if (job) jobs.push(job);
      }
      return jobs;
    }
    // Generous limit — we want to score the long tail, not silently truncate.
    const all = await this.jobRepo.query({ limit: 10_000 });
    return all.filter((j) => j.tierAi === null);
  }

  private async loadOneCandidate(options: ScoreOptions): Promise<Job | null> {
    const jobs = await this.loadCandidates(options);
    return jobs[0] ?? null;
  }
}
