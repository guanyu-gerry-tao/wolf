import { beforeEach, describe, expect, it } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initializeSchema } from '../initializeSchema.js';
import { SqliteBatchItemRepositoryImpl } from '../sqliteBatchItemRepositoryImpl.js';
import type { BatchItem } from '../../batchItemRepository.js';

// Real SQLite coverage for batch item persistence. Batch items are the
// durable handoff point between provider polling and business consumers
// like score/tailor/input, so these tests exercise insert, result update,
// error update, and consumed markers end-to-end.
describe('SqliteBatchItemRepositoryImpl', () => {
  let repo: SqliteBatchItemRepositoryImpl;

  function makeItem(overrides: Partial<BatchItem>): BatchItem {
    return {
      id: 'item-1',
      batchId: 'batch-1',
      customId: 'job:1',
      status: 'pending',
      resultText: null,
      errorMessage: null,
      consumedAt: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      completedAt: null,
      ...overrides,
    };
  }

  // Each test uses a fresh in-memory DB initialized through production DDL.
  beforeEach(() => {
    const sqlite = new BetterSqlite3(':memory:');
    const db = drizzle(sqlite);
    initializeSchema(db);
    repo = new SqliteBatchItemRepositoryImpl(db);
  });

  // Saving multiple pending rows establishes the request-to-result mapping
  // before the provider batch has finished.
  it('saves and lists items by batch id', async () => {
    await repo.saveMany([
      makeItem({ id: 'item-1', customId: 'job:1' }),
      makeItem({ id: 'item-2', customId: 'job:2' }),
      makeItem({ id: 'other-item', batchId: 'batch-2', customId: 'job:3' }),
    ]);

    const items = await repo.listByBatch('batch-1');

    expect(items.map((item) => item.customId).sort()).toEqual(['job:1', 'job:2']);
    expect(items.every((item) => item.status === 'pending')).toBe(true);
  });

  // Provider success writes normalized text and completion time without
  // requiring any score/tailor-specific parser to run in the batch layer.
  it('marks an item succeeded with normalized result text', async () => {
    await repo.saveMany([makeItem({ id: 'item-1', customId: 'job:1' })]);

    await repo.markSucceeded(
      'batch-1',
      'job:1',
      'model response text',
      '2026-05-01T00:10:00.000Z',
    );

    const [item] = await repo.listByBatch('batch-1');
    expect(item.status).toBe('succeeded');
    expect(item.resultText).toBe('model response text');
    expect(item.errorMessage).toBeNull();
    expect(item.completedAt).toBe('2026-05-01T00:10:00.000Z');
  });

  // Provider item failures are stored per item, so one failed request does
  // not erase successful siblings from the same batch.
  it('marks an item failed with provider error text', async () => {
    await repo.saveMany([makeItem({ id: 'item-1', customId: 'job:1' })]);

    await repo.markFailed(
      'batch-1',
      'job:1',
      'errored',
      'rate limit',
      '2026-05-01T00:11:00.000Z',
    );

    const [item] = await repo.listByBatch('batch-1');
    expect(item.status).toBe('errored');
    expect(item.resultText).toBeNull();
    expect(item.errorMessage).toBe('rate limit');
    expect(item.completedAt).toBe('2026-05-01T00:11:00.000Z');
  });

  // Business consumers mark items consumed after writing their own domain
  // state, which prevents duplicate writes during repeated polling/consume runs.
  it('marks an item consumed after a business service handles it', async () => {
    await repo.saveMany([makeItem({ id: 'item-1', customId: 'job:1' })]);
    await repo.markConsumed('item-1', '2026-05-01T00:12:00.000Z');

    const [item] = await repo.listByBatch('batch-1');
    expect(item.consumedAt).toBe('2026-05-01T00:12:00.000Z');
  });
});
