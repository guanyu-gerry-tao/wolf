import { beforeEach, describe, expect, it, vi } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { BatchServiceImpl } from '../impl/batchServiceImpl.js';
import { SqliteBatchRepositoryImpl } from '../../repository/impl/sqliteBatchRepositoryImpl.js';
import { SqliteBatchItemRepositoryImpl } from '../../repository/impl/sqliteBatchItemRepositoryImpl.js';
import { initializeSchema } from '../../repository/impl/initializeSchema.js';
import type { JobRepository } from '../../repository/jobRepository.js';

const {
  mockAnthropicBatchCreate,
  mockAnthropicBatchRetrieve,
  mockAnthropicBatchResults,
  mockAnthropicConstructor,
} = vi.hoisted(() => ({
  mockAnthropicBatchCreate: vi.fn().mockResolvedValue({
    id: 'msgbatch_test_123',
    processing_status: 'in_progress',
  }),
  mockAnthropicBatchRetrieve: vi.fn(),
  mockAnthropicBatchResults: vi.fn(),
  mockAnthropicConstructor: vi.fn(),
}));

// The Anthropic SDK is mocked so batch tests verify request shape without network I/O.
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function (opts: unknown) {
    mockAnthropicConstructor(opts);
    return {
      messages: {
        batches: {
          create: mockAnthropicBatchCreate,
          retrieve: mockAnthropicBatchRetrieve,
          results: mockAnthropicBatchResults,
        },
      },
    };
  }),
}));

function makeRepos() {
  const sqlite = new BetterSqlite3(':memory:');
  const db = drizzle(sqlite);
  initializeSchema(db);
  return {
    batchRepo: new SqliteBatchRepositoryImpl(db),
    batchItemRepo: new SqliteBatchItemRepositoryImpl(db),
  };
}

const jobRepo = {} as JobRepository;

// BatchService owns provider-specific async AI batch submission.
describe('BatchServiceImpl.batchAiCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WOLF_ANTHROPIC_API_KEY;
  });

  // Anthropic batch submission must preserve custom IDs and map each prompt to one Messages request.
  it('submits Anthropic message batches and returns the provider batch id', async () => {
    process.env.WOLF_ANTHROPIC_API_KEY = 'test-anthropic-key';
    const { batchRepo, batchItemRepo } = makeRepos();
    const service = new BatchServiceImpl(batchRepo, batchItemRepo, jobRepo);

    const result = await service.batchAiCall(
      [
        { customId: 'job-1', prompt: 'Score job one', systemPrompt: 'Return JSON only.' },
        { customId: 'job-2', prompt: 'Score job two' },
      ],
      { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', maxTokens: 777 },
    );

    expect(result).toEqual({
      batchId: 'msgbatch_test_123',
      provider: 'anthropic',
      submitted: 2,
    });
    expect(mockAnthropicConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'test-anthropic-key' }),
    );
    expect(mockAnthropicBatchCreate).toHaveBeenCalledWith({
      requests: [
        {
          custom_id: 'job-1',
          params: {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 777,
            system: 'Return JSON only.',
            messages: [{ role: 'user', content: 'Score job one' }],
          },
        },
        {
          custom_id: 'job-2',
          params: {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 777,
            messages: [{ role: 'user', content: 'Score job two' }],
          },
        },
      ],
    });
  });

  // Empty batches are caller mistakes; fail before reaching the paid provider API.
  it('rejects empty batch requests before calling the provider', async () => {
    const { batchRepo, batchItemRepo } = makeRepos();
    const service = new BatchServiceImpl(batchRepo, batchItemRepo, jobRepo);

    await expect(
      service.batchAiCall([], { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }),
    ).rejects.toThrow(/at least one request/i);

    expect(mockAnthropicBatchCreate).not.toHaveBeenCalled();
  });

  // Anthropic requires each custom_id to be 1..64 chars and unique in the batch.
  // Validate locally so callers get a clear wolf error before a paid provider request.
  it('rejects invalid custom IDs before calling the provider', async () => {
    const { batchRepo, batchItemRepo } = makeRepos();
    const service = new BatchServiceImpl(batchRepo, batchItemRepo, jobRepo);

    await expect(
      service.batchAiCall(
        [{ customId: '', prompt: 'Score job one' }],
        { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
      ),
    ).rejects.toThrow(/customId.*1 and 64/i);

    await expect(
      service.batchAiCall(
        [
          { customId: 'job:1', prompt: 'Score job one' },
          { customId: 'job:1', prompt: 'Score job one again' },
        ],
        { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
      ),
    ).rejects.toThrow(/Duplicate batch customId/i);

    expect(mockAnthropicBatchCreate).not.toHaveBeenCalled();
  });

  // OpenAI is registered for synchronous calls, but this batch surface does not support it yet.
  it('throws a clear error for unsupported batch providers', async () => {
    const { batchRepo, batchItemRepo } = makeRepos();
    const service = new BatchServiceImpl(batchRepo, batchItemRepo, jobRepo);

    await expect(
      service.batchAiCall(
        [{ customId: 'job-1', prompt: 'Score job one' }],
        { provider: 'openai', model: 'gpt-4o' },
      ),
    ).rejects.toThrow(/Batch AI provider "openai" is not supported/i);

    expect(mockAnthropicBatchCreate).not.toHaveBeenCalled();
  });

  // Base submit persists both the provider batch row and per-request pending item rows.
  it('submitAiBatch stores batch metadata and pending item rows', async () => {
    const { batchRepo, batchItemRepo } = makeRepos();
    const service = new BatchServiceImpl(batchRepo, batchItemRepo, jobRepo);

    const submission = await service.submitAiBatch(
      [
        { customId: 'job:1', prompt: 'Score job one' },
        { customId: 'job:2', prompt: 'Score job two' },
      ],
      {
        type: 'score',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        profileId: 'default',
      },
    );

    const pending = await batchRepo.getPending();
    const items = await batchItemRepo.listByBatch(submission.id);
    expect(submission).toMatchObject({
      batchId: 'msgbatch_test_123',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      type: 'score',
      submitted: 2,
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      id: submission.id,
      batchId: 'msgbatch_test_123',
      type: 'score',
      aiProvider: 'anthropic',
      profileId: 'default',
      status: 'pending',
    });
    expect(items.map((item) => ({
      customId: item.customId,
      status: item.status,
      resultText: item.resultText,
    }))).toEqual([
      { customId: 'job:1', status: 'pending', resultText: null },
      { customId: 'job:2', status: 'pending', resultText: null },
    ]);
  });

  // Polling an in-progress provider batch should leave local metadata pending.
  it('pollAiBatches leaves in-progress batches pending', async () => {
    const { batchRepo, batchItemRepo } = makeRepos();
    const service = new BatchServiceImpl(batchRepo, batchItemRepo, jobRepo);
    const submission = await service.submitAiBatch(
      [{ customId: 'job:1', prompt: 'Score job one' }],
      { type: 'score', provider: 'anthropic', model: 'claude-haiku-4-5-20251001', profileId: 'default' },
    );
    mockAnthropicBatchRetrieve.mockResolvedValue({ id: 'msgbatch_test_123', processing_status: 'in_progress' });

    const summary = await service.pollAiBatches();

    expect(summary).toEqual({ polled: 1, completed: 0, failed: 0, itemsSucceeded: 0, itemsFailed: 0 });
    expect(await batchRepo.getPending()).toHaveLength(1);
    expect(await batchItemRepo.listByBatch(submission.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ customId: 'job:1', status: 'pending' })]),
    );
  });

  // Polling an ended provider batch normalizes provider-specific item results into batch_items.
  it('pollAiBatches stores normalized item results when a provider batch ends', async () => {
    const { batchRepo, batchItemRepo } = makeRepos();
    const service = new BatchServiceImpl(batchRepo, batchItemRepo, jobRepo);
    const submission = await service.submitAiBatch(
      [
        { customId: 'job:1', prompt: 'Score job one' },
        { customId: 'job:2', prompt: 'Score job two' },
        { customId: 'job:3', prompt: 'Score job three' },
      ],
      { type: 'score', provider: 'anthropic', model: 'claude-haiku-4-5-20251001', profileId: 'default' },
    );
    mockAnthropicBatchRetrieve.mockResolvedValue({ id: 'msgbatch_test_123', processing_status: 'ended' });
    mockAnthropicBatchResults.mockResolvedValue([
      {
        custom_id: 'job:1',
        result: {
          type: 'succeeded',
          message: { content: [{ type: 'text', text: '{"score":0.9}' }] },
        },
      },
      {
        custom_id: 'job:2',
        result: {
          type: 'errored',
          error: { type: 'error', error: { type: 'invalid_request_error', message: 'bad request' } },
        },
      },
      {
        custom_id: 'job:3',
        result: { type: 'expired' },
      },
    ]);

    const summary = await service.pollAiBatches();

    const items = await batchItemRepo.listByBatch(submission.id);
    expect(summary).toEqual({ polled: 1, completed: 1, failed: 0, itemsSucceeded: 1, itemsFailed: 2 });
    expect(await batchRepo.getPending()).toHaveLength(0);
    expect(items).toEqual([
      expect.objectContaining({ customId: 'job:1', status: 'succeeded', resultText: '{"score":0.9}', errorMessage: null }),
      expect.objectContaining({ customId: 'job:2', status: 'errored', resultText: null, errorMessage: 'bad request' }),
      expect.objectContaining({ customId: 'job:3', status: 'expired', resultText: null, errorMessage: 'expired' }),
    ]);
  });
});
