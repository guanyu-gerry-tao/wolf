import { randomUUID } from 'node:crypto';
import type {
  BatchAiCallOptions,
  BatchAiCallRequest,
  BatchAiCallResult,
  BatchPollSummary,
  BatchService,
  BatchSubmission,
  BatchSubmitOptions,
  SubmitAiBatchOptions,
} from '../batchService.js';
import type { BatchRepository } from '../../repository/batchRepository.js';
import type { BatchItemRepository } from '../../repository/batchItemRepository.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { Job } from '../../utils/types/index.js';
import { AnthropicBatchProviderAdapter } from './batch/anthropicBatchProviderAdapter.js';
import type { BatchProviderAdapter } from './batch/batchProviderAdapter.js';

/**
 * Default `BatchService` impl. Stub until M3+: real implementation lives on
 * `dev/v0.3:src/utils/batch.ts` and will be ported here once the Batch API
 * scoring path lands. Persists batch metadata via `BatchRepository`; reads
 * Job rows back through `JobRepository` to attach scoring results.
 */
export class BatchServiceImpl implements BatchService {
  constructor(
    private readonly batchRepo: BatchRepository,
    private readonly batchItemRepo: BatchItemRepository,
    private readonly jobRepo: JobRepository,
  ) {}

  /** @inheritdoc */
  async batchAiCall(
    requests: BatchAiCallRequest[],
    options: BatchAiCallOptions,
  ): Promise<BatchAiCallResult> {
    if (requests.length === 0) {
      throw new Error('Batch AI call requires at least one request.');
    }
    validateBatchRequests(requests);

    if (options.provider !== 'anthropic') {
      throw new Error(`Batch AI provider "${options.provider}" is not supported yet.`);
    }

    const batchId = await this.adapterFor(options.provider).submit(requests, options);

    return {
      batchId,
      provider: 'anthropic',
      submitted: requests.length,
    };
  }

  /** @inheritdoc */
  async submitAiBatch(
    requests: BatchAiCallRequest[],
    options: SubmitAiBatchOptions,
  ): Promise<BatchSubmission> {
    const result = await this.batchAiCall(requests, options);
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.batchRepo.save({
      id,
      batchId: result.batchId,
      type: options.type,
      aiProvider: result.provider,
      model: options.model,
      profileId: options.profileId,
      status: 'pending',
      errorMessage: null,
      submittedAt: now,
      completedAt: null,
    });

    await this.batchItemRepo.saveMany(requests.map((request) => ({
      id: randomUUID(),
      batchId: id,
      customId: request.customId,
      status: 'pending',
      resultText: null,
      errorMessage: null,
      consumedAt: null,
      createdAt: now,
      completedAt: null,
    })));

    return {
      id,
      batchId: result.batchId,
      provider: result.provider,
      type: options.type,
      model: options.model,
      submitted: result.submitted,
    };
  }

  /** @inheritdoc */
  async pollAiBatches(): Promise<BatchPollSummary> {
    const pending = await this.batchRepo.getPending();
    const summary: BatchPollSummary = {
      polled: pending.length,
      completed: 0,
      failed: 0,
      itemsSucceeded: 0,
      itemsFailed: 0,
    };

    for (const batch of pending) {
      const adapter = this.adapterFor(batch.aiProvider);
      try {
        const status = await adapter.retrieve(batch.batchId);
        if (status !== 'ended') continue;

        const completedAt = new Date().toISOString();
        const results = await adapter.results(batch.batchId);
        for (const item of results) {
          if (item.status === 'succeeded') {
            await this.batchItemRepo.markSucceeded(
              batch.id,
              item.customId,
              item.resultText ?? '',
              completedAt,
            );
            summary.itemsSucceeded += 1;
          } else {
            await this.batchItemRepo.markFailed(
              batch.id,
              item.customId,
              item.status,
              item.errorMessage ?? item.status,
              completedAt,
            );
            summary.itemsFailed += 1;
          }
        }
        await this.batchRepo.markComplete(batch.id, completedAt);
        summary.completed += 1;
      } catch (err) {
        await this.batchRepo.markFailed(batch.id, err instanceof Error ? err.message : String(err));
        summary.failed += 1;
      }
    }

    return summary;
  }

  /** @inheritdoc */
  async submit(_jobs: Job[], _options: BatchSubmitOptions): Promise<string> {
    throw new Error('Not implemented (M3+) — see dev/v0.3:src/utils/batch.ts for reference');
  }

  /** @inheritdoc */
  async pollAll(): Promise<void> {
    throw new Error('Not implemented (M3+) — see dev/v0.3:src/utils/batch.ts for reference');
  }

  private adapterFor(provider: BatchAiCallOptions['provider']): BatchProviderAdapter {
    if (provider === 'anthropic') return new AnthropicBatchProviderAdapter();
    throw new Error(`Batch AI provider "${provider}" is not supported yet.`);
  }
}

function validateBatchRequests(requests: BatchAiCallRequest[]): void {
  const seen = new Set<string>();
  for (const request of requests) {
    if (request.customId.length < 1 || request.customId.length > 64) {
      throw new Error(
        `Batch request customId must be between 1 and 64 characters: "${request.customId}"`,
      );
    }
    if (seen.has(request.customId)) {
      throw new Error(`Duplicate batch customId "${request.customId}" in one request batch.`);
    }
    seen.add(request.customId);
  }
}
