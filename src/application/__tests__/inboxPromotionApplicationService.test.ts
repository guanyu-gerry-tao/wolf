import { afterEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { sink } from 'pino-test';
import { InboxPromotionApplicationServiceImpl } from '../impl/inboxPromotionApplicationServiceImpl.js';
import { createSilentLogger, setDefaultLogger } from '../../utils/logger.js';
import type { BackgroundAiBatchRepository } from '../../repository/backgroundAiBatchRepository.js';
import type { InboxItem, InboxRepository } from '../../repository/inboxRepository.js';

// Inbox promotion is paid work, so it must be explicitly requested and stored
// as background AI batch state rather than happening automatically on capture.
describe('InboxPromotionApplicationServiceImpl', () => {
  // Logging tests install a live pino sink, so reset the shared facade between
  // examples.
  afterEach(() => setDefaultLogger(createSilentLogger()));

  function makeItem(id: string): InboxItem {
    return {
      id,
      kind: 'manual_page',
      source: 'wolf_companion',
      url: `https://example.com/jobs/${id}`,
      title: `Role ${id}`,
      rawJson: `{"html":"${id}"}`,
      rawSha256: `sha-${id}`,
      status: 'raw',
      jobId: null,
      receivedAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      error: null,
    };
  }

  // Empty raw queues should not create a fake paid batch. The UI can report
  // that there is nothing to promote.
  it('returns empty when no raw inbox items are available', async () => {
    const inboxRepo = {
      listByStatus: vi.fn(async () => []),
    } as unknown as InboxRepository;
    const batchRepo = {
      saveBatch: vi.fn(),
    } as unknown as BackgroundAiBatchRepository;
    const app = new InboxPromotionApplicationServiceImpl(inboxRepo, batchRepo);

    const result = await app.promoteRawInbox({ limit: 20, provider: 'anthropic', shardSize: 20 });

    expect(result).toEqual({ batchId: null, status: 'empty', itemCount: 0, shardCount: 0 });
    expect(batchRepo.saveBatch).not.toHaveBeenCalled();
  });

  // One user request creates a durable batch, shards of at most 20 items, and
  // item records that point back to inbox_items via subject_id.
  it('creates queued background AI batch state for raw inbox items', async () => {
    const rawItems = [makeItem('a'), makeItem('b'), makeItem('c')];
    const inboxRepo = {
      listByStatus: vi.fn(async () => rawItems),
      updateStatus: vi.fn(async () => undefined),
    } as unknown as InboxRepository;
    const batchRepo = {
      saveBatch: vi.fn(async () => undefined),
      saveShard: vi.fn(async () => undefined),
      saveItem: vi.fn(async () => undefined),
    } as unknown as BackgroundAiBatchRepository;
    const app = new InboxPromotionApplicationServiceImpl(inboxRepo, batchRepo);

    const result = await app.promoteRawInbox({ limit: 3, provider: 'anthropic', shardSize: 2 });

    expect(result).toMatchObject({ status: 'queued', itemCount: 3, shardCount: 2 });
    expect(result.batchId).toMatch(/^inbox_promote_/);
    expect(batchRepo.saveBatch).toHaveBeenCalledWith(expect.objectContaining({
      id: result.batchId,
      type: 'inbox_promote',
      status: 'queued',
    }));
    expect(batchRepo.saveShard).toHaveBeenCalledTimes(2);
    expect(batchRepo.saveItem).toHaveBeenCalledTimes(3);
    expect(batchRepo.saveItem).toHaveBeenCalledWith(expect.objectContaining({
      backgroundAiBatchId: result.batchId,
      subjectType: 'inbox_item',
      subjectId: 'a',
      status: 'queued',
      aiInputJson: expect.stringContaining('"rawJson"'),
    }));
    expect(inboxRepo.updateStatus).toHaveBeenCalledWith('a', { status: 'queued', error: null });
  });

  // Promotion should leave an operator-visible breadcrumb with the created
  // batch id and counts.
  it('logs an info event when inbox promotion is queued', async () => {
    const stream = sink();
    setDefaultLogger(pino({ level: 'debug' }, stream));
    const events: Record<string, unknown>[] = [];
    stream.on('data', (line) => events.push(line));

    const rawItems = [makeItem('a')];
    const inboxRepo = {
      listByStatus: vi.fn(async () => rawItems),
      updateStatus: vi.fn(async () => undefined),
    } as unknown as InboxRepository;
    const batchRepo = {
      saveBatch: vi.fn(async () => undefined),
      saveShard: vi.fn(async () => undefined),
      saveItem: vi.fn(async () => undefined),
    } as unknown as BackgroundAiBatchRepository;
    const app = new InboxPromotionApplicationServiceImpl(inboxRepo, batchRepo);

    const result = await app.promoteRawInbox({ limit: 20, provider: 'anthropic', shardSize: 20 });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      msg: 'inbox.promote.queued',
      level: 30,
      batchId: result.batchId,
      itemCount: 1,
      shardCount: 1,
    });
  });
});
