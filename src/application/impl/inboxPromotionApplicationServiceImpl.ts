import { randomUUID } from 'node:crypto';
import type { BackgroundAiBatchRepository } from '../../repository/backgroundAiBatchRepository.js';
import type { InboxItem, InboxRepository } from '../../repository/inboxRepository.js';
import type {
  InboxPromoteOptions,
  InboxPromoteResult,
  InboxPromotionApplicationService,
} from '../inboxPromotionApplicationService.js';
import { log } from '../../utils/logger.js';

export class InboxPromotionApplicationServiceImpl implements InboxPromotionApplicationService {
  constructor(
    private readonly inboxRepository: InboxRepository,
    private readonly backgroundAiBatchRepository: BackgroundAiBatchRepository,
  ) {}

  async promoteRawInbox(options: InboxPromoteOptions): Promise<InboxPromoteResult> {
    const rawItems = await this.inboxRepository.listByStatus('raw', options.limit);
    if (rawItems.length === 0) {
      log.info('inbox.promote.empty', {
        limit: options.limit,
        provider: options.provider,
        shardSize: options.shardSize,
      });
      return { batchId: null, status: 'empty', itemCount: 0, shardCount: 0 };
    }

    const now = new Date().toISOString();
    const batchId = `inbox_promote_${randomUUID()}`;
    const shards = chunk(rawItems, options.shardSize);

    await this.backgroundAiBatchRepository.saveBatch({
      id: batchId,
      type: 'inbox_promote',
      status: 'queued',
      inputJson: JSON.stringify({
        limit: options.limit,
        provider: options.provider,
        shardSize: options.shardSize,
        inboxItemIds: rawItems.map((item) => item.id),
      }),
      createdAt: now,
      updatedAt: now,
      deadlineAt: null,
      error: null,
    });

    for (let shardIndex = 0; shardIndex < shards.length; shardIndex += 1) {
      const shardItems = shards[shardIndex];
      const shardId = `${batchId}_shard_${shardIndex + 1}`;

      await this.backgroundAiBatchRepository.saveShard({
        id: shardId,
        backgroundAiBatchId: batchId,
        provider: options.provider,
        providerBatchId: null,
        status: 'queued',
        itemCount: shardItems.length,
        nextPollAt: null,
        submittedAt: null,
        completedAt: null,
        error: null,
      });

      for (const item of shardItems) {
        await this.backgroundAiBatchRepository.saveItem({
          id: `${batchId}_item_${item.id}`,
          backgroundAiBatchId: batchId,
          shardId,
          subjectType: 'inbox_item',
          subjectId: item.id,
          status: 'queued',
          aiInputJson: buildPromotionInput(item),
          debugJson: null,
          debugExpiresAt: null,
          targetId: null,
          error: null,
        });
        await this.inboxRepository.updateStatus(item.id, { status: 'queued', error: null });
      }
    }

    log.info('inbox.promote.queued', {
      batchId,
      provider: options.provider,
      itemCount: rawItems.length,
      shardCount: shards.length,
    });

    return {
      batchId,
      status: 'queued',
      itemCount: rawItems.length,
      shardCount: shards.length,
    };
  }
}

function buildPromotionInput(item: InboxItem): string {
  return JSON.stringify({
    inboxItemId: item.id,
    kind: item.kind,
    source: item.source,
    url: item.url,
    title: item.title,
    rawJson: item.rawJson,
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
