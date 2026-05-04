import { afterEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { sink } from 'pino-test';
import { InboxPromotionApplicationServiceImpl } from '../impl/inboxPromotionApplicationServiceImpl.js';
import { createSilentLogger, setDefaultLogger } from '../../utils/logger.js';
import type { BackgroundAiBatchRepository } from '../../repository/backgroundAiBatchRepository.js';
import type { InboxItem, InboxRepository } from '../../repository/inboxRepository.js';
import type { BatchService } from '../../service/batchService.js';

// Inbox promotion is explicit user-triggered work. It may be backed by paid AI
// batch state, but the local companion MVP can promote simple manual pages
// directly into jobs without running provider batch plumbing.
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

  // Empty raw queues should not create a fake batch. The UI can report that
  // there is nothing to process.
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

  // Without a direct job-creation service, one user request creates durable
  // batch state and item records that point back to inbox_items via subject_id.
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

  // When the companion has AddApplicationService available, Process Inbox is
  // usable without waiting for provider batch plumbing: raw manual pages become
  // tracked jobs and the inbox item is marked promoted.
  it('can promote raw manual pages directly into jobs', async () => {
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
    const addApp = {
      add: vi.fn(async () => ({ jobId: 'job-1' })),
    };
    const app = new InboxPromotionApplicationServiceImpl(inboxRepo, batchRepo, addApp);

    const result = await app.promoteRawInbox({ limit: 20, provider: 'anthropic', shardSize: 20 });

    expect(result).toMatchObject({
      status: 'completed',
      jobIds: ['job-1'],
    });
    expect(addApp.add).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Role a',
      url: 'https://example.com/jobs/a',
      jdText: 'a',
    }));
    expect(inboxRepo.updateStatus).toHaveBeenCalledWith('a', {
      status: 'promoted',
      jobId: 'job-1',
      error: null,
    });
  });

  // Once BatchService is available, Process Inbox should use the provider
  // Batch API for structured extraction instead of the rough local HTML
  // fallback. The returned batch id becomes the run id the side panel polls.
  it('submits raw inbox items to the base AI batch runtime when available', async () => {
    const rawItems = [makeItem('a'), makeItem('b')];
    const inboxRepo = {
      listByStatus: vi.fn(async () => rawItems),
      updateStatus: vi.fn(async () => undefined),
    } as unknown as InboxRepository;
    const batchRepo = {
      saveBatch: vi.fn(async () => undefined),
    } as unknown as BackgroundAiBatchRepository;
    const submitAiBatch = vi.fn<BatchService['submitAiBatch']>().mockResolvedValue({
      id: 'inbox-run-1',
      batchId: 'msgbatch_inbox_1',
      provider: 'anthropic',
      type: 'inbox_promote',
      model: 'claude-haiku-4-5-20251001',
      submitted: 2,
    });
    const app = new InboxPromotionApplicationServiceImpl(
      inboxRepo,
      batchRepo,
      undefined,
      {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
      },
      { submitAiBatch } as unknown as BatchService,
    );

    const result = await app.promoteRawInbox({ limit: 20, provider: 'anthropic', shardSize: 20 });

    expect(result).toMatchObject({
      batchId: 'inbox-run-1',
      status: 'queued',
      itemCount: 2,
      shardCount: 1,
    });
    expect(submitAiBatch).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          customId: 'a',
          prompt: expect.stringContaining('"inboxItemId":"a"'),
        }),
        expect.objectContaining({
          customId: 'b',
          prompt: expect.stringContaining('"inboxItemId":"b"'),
        }),
      ],
      {
        type: 'inbox_promote',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        profileId: 'default',
        maxTokens: 4000,
      },
    );
    expect(inboxRepo.updateStatus).toHaveBeenCalledWith('a', { status: 'queued', error: null });
    expect(batchRepo.saveBatch).not.toHaveBeenCalled();
  });
});
