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

/**
 * Domain service for AI batch jobs. Hides the provider-specific submission
 * and polling APIs behind a uniform interface and persists every batch's
 * status to the `batches` table via `BatchRepository` so a process restart
 * doesn't lose track of in-flight work.
 */
export interface BatchService {
  /** Submit jobs to the AI provider batch API. Returns the internal batch id. */
  submit(jobs: Job[], options: BatchSubmitOptions): Promise<string>;
  /** Poll all pending batches and write results back when complete. */
  pollAll(): Promise<void>;
}
