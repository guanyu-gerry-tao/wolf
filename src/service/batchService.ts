import type { Job } from '../utils/types/index.js';
import type { Profile } from '../utils/types/index.js';

/** What a batch is doing — drives the result handler that runs on completion. */
export type BatchType = 'score' | 'tailor';

/** AI provider behind the batch. Different providers expose different APIs. */
export type BatchAiProvider = 'anthropic' | 'openai';

/** Submit-time arguments. `profileId` is recorded so the result handler can rehydrate context. */
export interface BatchSubmitOptions {
  type: BatchType;
  aiProvider: BatchAiProvider;
  profile: Profile;
  profileId: string;
}

/** One prompt request submitted through a provider's async batch API. */
export interface BatchAiCallRequest {
  /** Caller-owned ID used to match provider results back to local rows. */
  customId: string;
  /** User message for this single batch request. */
  prompt: string;
  /** Optional system prompt for this single batch request. */
  systemPrompt?: string;
}

/** Provider and model selection for a raw async AI batch submission. */
export interface BatchAiCallOptions {
  provider: BatchAiProvider;
  model: string;
  /** Defaults to 4096, matching the synchronous Anthropic family call. */
  maxTokens?: number;
}

/** Minimal submission result shared by provider-specific batch APIs. */
export interface BatchAiCallResult {
  /** External ID returned by the AI provider. */
  batchId: string;
  provider: BatchAiProvider;
  submitted: number;
}

/** Submit-time options for a durable base AI batch. */
export interface SubmitAiBatchOptions extends BatchAiCallOptions {
  type: BatchType;
  profileId: string;
}

/** Durable submission result returned after metadata and pending items are stored. */
export interface BatchSubmission extends BatchAiCallResult {
  id: string;
  type: BatchType;
  model: string;
}

/** Summary of one polling run across pending provider batches. */
export interface BatchPollSummary {
  polled: number;
  completed: number;
  failed: number;
  itemsSucceeded: number;
  itemsFailed: number;
}

/**
 * Domain service for AI batch jobs. Hides the provider-specific submission
 * and polling APIs behind a uniform interface and persists every batch's
 * status to the `batches` table via `BatchRepository` so a process restart
 * doesn't lose track of in-flight work.
 */
export interface BatchService {
  /** Submit raw prompt requests through a provider's async batch API. */
  batchAiCall(requests: BatchAiCallRequest[], options: BatchAiCallOptions): Promise<BatchAiCallResult>;
  /** Submit and persist a durable base AI batch for later polling/consumption. */
  submitAiBatch(requests: BatchAiCallRequest[], options: SubmitAiBatchOptions): Promise<BatchSubmission>;
  /** Poll pending durable AI batches and persist normalized item results. */
  pollAiBatches(): Promise<BatchPollSummary>;
  /** Submit jobs to the AI provider batch API. Returns the internal batch id. */
  submit(jobs: Job[], options: BatchSubmitOptions): Promise<string>;
  /** Poll all pending batches and write results back when complete. */
  pollAll(): Promise<void>;
}
