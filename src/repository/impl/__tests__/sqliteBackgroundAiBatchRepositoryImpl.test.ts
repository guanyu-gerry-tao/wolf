import { describe, expect, it } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initializeSchema } from '../initializeSchema.js';
import { SqliteBackgroundAiBatchRepositoryImpl } from '../sqliteBackgroundAiBatchRepositoryImpl.js';
import type {
  BackgroundAiBatch,
  BackgroundAiBatchItem,
  BackgroundAiBatchShard,
} from '../../backgroundAiBatchRepository.js';

// Background AI batches track long-running paid AI work independently of the
// canonical job records they eventually update.
describe('SqliteBackgroundAiBatchRepositoryImpl', () => {
  function makeRepo(): SqliteBackgroundAiBatchRepositoryImpl {
    const sqlite = new BetterSqlite3(':memory:');
    const db = drizzle(sqlite);
    initializeSchema(db);
    return new SqliteBackgroundAiBatchRepositoryImpl(db);
  }

  function makeBatch(): BackgroundAiBatch {
    return {
      id: 'batch-1',
      type: 'inbox_promote',
      status: 'waiting_ai',
      inputJson: '{"limit":20}',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deadlineAt: null,
      error: null,
    };
  }

  function makeShard(overrides: Partial<BackgroundAiBatchShard> = {}): BackgroundAiBatchShard {
    return {
      id: 'shard-1',
      backgroundAiBatchId: 'batch-1',
      provider: 'anthropic',
      providerBatchId: 'provider-1',
      status: 'waiting_ai',
      itemCount: 1,
      nextPollAt: '2026-05-01T00:01:00.000Z',
      submittedAt: '2026-05-01T00:00:00.000Z',
      completedAt: null,
      error: null,
      ...overrides,
    };
  }

  function makeItem(overrides: Partial<BackgroundAiBatchItem> = {}): BackgroundAiBatchItem {
    return {
      id: 'item-1',
      backgroundAiBatchId: 'batch-1',
      shardId: 'shard-1',
      subjectType: 'inbox_item',
      subjectId: 'inbox-1',
      status: 'waiting_ai',
      aiInputJson: '{"html":"..."}',
      debugJson: null,
      debugExpiresAt: null,
      targetId: null,
      error: null,
      ...overrides,
    };
  }

  // One user action creates a batch, one or more provider shards, and item
  // rows that can each succeed/fail independently.
  it('creates a background AI batch with shards and items', async () => {
    const repo = makeRepo();
    await repo.saveBatch(makeBatch());
    await repo.saveShard(makeShard());
    await repo.saveItem(makeItem());

    expect(await repo.getBatch('batch-1')).toMatchObject({ id: 'batch-1', type: 'inbox_promote' });
    expect(await repo.listShards('batch-1')).toHaveLength(1);
    expect(await repo.listItems('batch-1')).toHaveLength(1);
  });

  // Provider polling must respect next_poll_at. This keeps the serve worker
  // cheap even when it ticks more often than the AI batch poll interval.
  it('lists only submitted or waiting shards whose next poll time is due', async () => {
    const repo = makeRepo();
    await repo.saveBatch(makeBatch());
    await repo.saveShard(makeShard({
      id: 'due',
      status: 'waiting_ai',
      nextPollAt: '2026-05-01T00:00:00.000Z',
    }));
    await repo.saveShard(makeShard({
      id: 'future',
      status: 'waiting_ai',
      nextPollAt: '2026-05-01T00:02:00.000Z',
    }));
    await repo.saveShard(makeShard({
      id: 'queued',
      status: 'queued',
      nextPollAt: '2026-05-01T00:00:00.000Z',
    }));

    const rows = await repo.listShardsReadyForPoll('2026-05-01T00:01:00.000Z', 25);

    expect(rows.map((row) => row.id)).toEqual(['due']);
  });

  // Successful item output is diagnostic only; it should expire after seven
  // days while keeping the target id and status intact.
  it('clears expired successful debug payloads without touching target ids', async () => {
    const repo = makeRepo();
    await repo.saveBatch(makeBatch());
    await repo.saveShard(makeShard());
    await repo.saveItem(makeItem({
      status: 'promoted',
      targetId: 'job-1',
      debugJson: '{"title":"Role"}',
      debugExpiresAt: '2026-05-08T00:00:00.000Z',
    }));

    const cleared = await repo.clearExpiredDebug('2026-05-09T00:00:00.000Z');
    const [item] = await repo.listItems('batch-1');

    expect(cleared).toBe(1);
    expect(item).toMatchObject({
      status: 'promoted',
      targetId: 'job-1',
      debugJson: null,
      debugExpiresAt: null,
    });
  });

  // Failed debug has no expiry by default; it stays available for retry and
  // diagnosis until a user or retry flow explicitly clears it.
  it('keeps failed debug payloads that do not have an expiry', async () => {
    const repo = makeRepo();
    await repo.saveBatch(makeBatch());
    await repo.saveShard(makeShard());
    await repo.saveItem(makeItem({
      id: 'failed-item',
      status: 'failed',
      debugJson: '{"bad":"output"}',
      debugExpiresAt: null,
      error: 'invalid AI output',
    }));

    const cleared = await repo.clearExpiredDebug('2026-05-09T00:00:00.000Z');
    const [item] = await repo.listItems('batch-1');

    expect(cleared).toBe(0);
    expect(item.debugJson).toBe('{"bad":"output"}');
  });
});
