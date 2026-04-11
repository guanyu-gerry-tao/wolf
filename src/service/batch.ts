import type { Job } from '../types/index.js';
import type { UserProfile } from '../types/index.js';

export type BatchType = 'score' | 'tailor';
export type BatchAiProvider = 'anthropic' | 'openai';

export interface BatchSubmitOptions {
  type: BatchType;
  aiProvider: BatchAiProvider;
  profile: UserProfile;
  profileId: string;
}

export interface BatchService {
  /** Submit jobs to the AI provider batch API. Returns the internal batch id. */
  submit(jobs: Job[], options: BatchSubmitOptions): Promise<string>;
  /** Poll all pending batches and write results back when complete. */
  pollAll(): Promise<void>;
}
