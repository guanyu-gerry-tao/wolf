import type { Job } from '../utils/types/index.js';
import type { AiConfig } from '../utils/types/index.js';
import type { TierIndex } from '../utils/scoringTiers.js';

/**
 * Parsed result of one tier-evaluation AI call.
 *
 * `tier` is the index into `TIER_NAMES` (`src/utils/scoringTiers.ts`).
 * `comment` is the assembled markdown blob (`## Tier`, `## Pros`, `## Cons`
 * sections) that goes into `Job.scoreJustification`.
 */
export interface ScoreOutcome {
  tier: TierIndex;
  comment: string;
}

/** Wolf-internal handle returned after a batch is enqueued with the provider. */
export interface BatchSubmissionSummary {
  batchId: string;
  submitted: number;
}

/** A job + its JD body, paired for batch submission so the service does no I/O. */
export interface JobToScore {
  job: Job;
  jdText: string;
}

/**
 * Domain service that produces AI tier verdicts for jobs.
 *
 * Two modes:
 *
 *   - `scoreOne`     synchronous one-job evaluation via `aiClient`
 *                    (used by `wolf score --single`)
 *   - `submitBatch`  enqueue N jobs into the provider's async Batch API
 *                    via `BatchService.submitAiBatch` (default mode)
 *
 * Polling and write-back live in `ScoreApplicationService` — that orchestrates
 * `BatchService.pollAiBatches`, walks completed batches, parses each item via
 * the exported `parseScoreResponse`, and updates Job rows.
 *
 * The AI is asked to emit one of N predefined tiers + pros/cons markdown.
 * Filtering / thresholding is downstream — `wolf tailor` decides what to do
 * with each tier.
 */
export interface ScoringService {
  /** Synchronous AI call. Returns a parsed outcome or throws on parse failure. */
  scoreOne(
    job: Job,
    jdText: string,
    profileMd: string,
    profileScoreMd: string,
    aiConfig: AiConfig,
  ): Promise<ScoreOutcome>;

  /**
   * Build N batch requests (one per job) and submit them through `BatchService`.
   * The wolf-internal `batchId` is returned so callers can later look up
   * completion status via `BatchRepository`.
   */
  submitBatch(
    jobs: JobToScore[],
    profileMd: string,
    profileScoreMd: string,
    profileId: string,
    aiConfig: AiConfig,
  ): Promise<BatchSubmissionSummary>;
}
