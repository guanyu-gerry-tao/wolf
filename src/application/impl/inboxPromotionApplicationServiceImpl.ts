import { randomUUID } from 'node:crypto';
import type { BackgroundAiBatchRepository } from '../../repository/backgroundAiBatchRepository.js';
import type { InboxItem, InboxRepository } from '../../repository/inboxRepository.js';
import type { AddApplicationService } from '../addApplicationService.js';
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
    private readonly addApplicationService?: AddApplicationService,
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
    const canPromoteLocally = this.addApplicationService !== undefined;

    await this.backgroundAiBatchRepository.saveBatch({
      id: batchId,
      type: 'inbox_promote',
      status: canPromoteLocally ? 'completed' : 'queued',
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

    const promotedJobIds: string[] = [];
    for (let shardIndex = 0; shardIndex < shards.length; shardIndex += 1) {
      const shardItems = shards[shardIndex];
      const shardId = `${batchId}_shard_${shardIndex + 1}`;

      await this.backgroundAiBatchRepository.saveShard({
        id: shardId,
        backgroundAiBatchId: batchId,
        provider: options.provider,
        providerBatchId: null,
        status: canPromoteLocally ? 'completed' : 'queued',
        itemCount: shardItems.length,
        nextPollAt: null,
        submittedAt: null,
        completedAt: null,
        error: null,
      });

      for (const item of shardItems) {
        const promotedJobId = canPromoteLocally
          ? await this.promoteItemLocally(item).catch(async (err: unknown) => {
              await this.inboxRepository.updateStatus(item.id, {
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
              });
              return null;
            })
          : null;
        if (promotedJobId) promotedJobIds.push(promotedJobId);

        await this.backgroundAiBatchRepository.saveItem({
          id: `${batchId}_item_${item.id}`,
          backgroundAiBatchId: batchId,
          shardId,
          subjectType: 'inbox_item',
          subjectId: item.id,
          status: promotedJobId ? 'promoted' : canPromoteLocally ? 'failed' : 'queued',
          aiInputJson: buildPromotionInput(item),
          debugJson: null,
          debugExpiresAt: null,
          targetId: promotedJobId,
          error: promotedJobId || !canPromoteLocally ? null : 'Local inbox promotion failed.',
        });
        if (promotedJobId) {
          await this.inboxRepository.updateStatus(item.id, { status: 'promoted', jobId: promotedJobId, error: null });
        } else if (!canPromoteLocally) {
          await this.inboxRepository.updateStatus(item.id, { status: 'queued', error: null });
        }
      }
    }

    log.info(canPromoteLocally ? 'inbox.promote.completed' : 'inbox.promote.queued', {
      batchId,
      provider: options.provider,
      itemCount: rawItems.length,
      shardCount: shards.length,
    });

    return {
      batchId,
      status: canPromoteLocally ? 'completed' : 'queued',
      itemCount: rawItems.length,
      shardCount: shards.length,
      jobIds: promotedJobIds,
    };
  }

  private async promoteItemLocally(item: InboxItem): Promise<string> {
    if (!this.addApplicationService) throw new Error('AddApplicationService is unavailable.');
    const parsed = JSON.parse(item.rawJson) as {
      title?: string;
      url?: string;
      html?: string;
      results?: unknown[];
    };
    const title = cleanText(parsed.title ?? item.title ?? 'Imported Job');
    const url = parsed.url ?? item.url ?? '';
    const jdText = htmlToText(parsed.html ?? item.rawJson);
    const company = companyFromUrl(url);
    const result = await this.addApplicationService.add({
      title,
      company,
      url,
      jdText,
    });
    return result.jobId;
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

function htmlToText(html: string): string {
  return cleanText(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function companyFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const first = host.split('.')[0];
    return first ? first[0].toUpperCase() + first.slice(1) : 'Imported Company';
  } catch {
    return 'Imported Company';
  }
}
