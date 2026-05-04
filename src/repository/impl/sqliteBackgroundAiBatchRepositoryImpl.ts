import { and, eq, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';
import type {
  BackgroundAiBatch,
  BackgroundAiBatchItem,
  BackgroundAiBatchRepository,
  BackgroundAiBatchShard,
} from '../backgroundAiBatchRepository.js';
import type { DrizzleDb } from './drizzleDb.js';
import {
  backgroundAiBatchItems,
  backgroundAiBatchShards,
  backgroundAiBatches,
} from './schema.js';

export class SqliteBackgroundAiBatchRepositoryImpl implements BackgroundAiBatchRepository {
  constructor(private readonly db: DrizzleDb) {}

  async saveBatch(batch: BackgroundAiBatch): Promise<void> {
    await this.db.insert(backgroundAiBatches).values(batchToRow(batch));
  }

  async getBatch(id: string): Promise<BackgroundAiBatch | null> {
    const rows = await this.db
      .select()
      .from(backgroundAiBatches)
      .where(eq(backgroundAiBatches.id, id))
      .limit(1);
    return rows.length > 0 ? rowToBatch(rows[0]) : null;
  }

  async saveShard(shard: BackgroundAiBatchShard): Promise<void> {
    await this.db.insert(backgroundAiBatchShards).values(shardToRow(shard));
  }

  async listShards(batchId: string): Promise<BackgroundAiBatchShard[]> {
    const rows = await this.db
      .select()
      .from(backgroundAiBatchShards)
      .where(eq(backgroundAiBatchShards.backgroundAiBatchId, batchId));
    return rows.map(rowToShard);
  }

  async listShardsReadyForPoll(nowIso: string, limit: number): Promise<BackgroundAiBatchShard[]> {
    const rows = await this.db
      .select()
      .from(backgroundAiBatchShards)
      .where(and(
        inArray(backgroundAiBatchShards.status, ['submitted', 'waiting_ai']),
        or(
          isNull(backgroundAiBatchShards.nextPollAt),
          lte(backgroundAiBatchShards.nextPollAt, nowIso),
        ),
      ))
      .limit(limit);
    return rows.map(rowToShard);
  }

  async saveItem(item: BackgroundAiBatchItem): Promise<void> {
    await this.db.insert(backgroundAiBatchItems).values(itemToRow(item));
  }

  async listItems(batchId: string): Promise<BackgroundAiBatchItem[]> {
    const rows = await this.db
      .select()
      .from(backgroundAiBatchItems)
      .where(eq(backgroundAiBatchItems.backgroundAiBatchId, batchId));
    return rows.map(rowToItem);
  }

  async updateItemStatus(
    id: string,
    patch: Partial<Pick<BackgroundAiBatchItem, 'status' | 'targetId' | 'error' | 'debugJson' | 'debugExpiresAt'>>,
  ): Promise<void> {
    await this.db
      .update(backgroundAiBatchItems)
      .set(patch)
      .where(eq(backgroundAiBatchItems.id, id));
  }

  async clearExpiredDebug(nowIso: string): Promise<number> {
    const rows = await this.db
      .select({ id: backgroundAiBatchItems.id })
      .from(backgroundAiBatchItems)
      .where(and(
        isNotNull(backgroundAiBatchItems.debugExpiresAt),
        lte(backgroundAiBatchItems.debugExpiresAt, nowIso),
      ));
    for (const row of rows) {
      await this.db
        .update(backgroundAiBatchItems)
        .set({ debugJson: null, debugExpiresAt: null })
        .where(eq(backgroundAiBatchItems.id, row.id));
    }
    return rows.length;
  }
}

type BatchRow = typeof backgroundAiBatches.$inferSelect;
type ShardRow = typeof backgroundAiBatchShards.$inferSelect;
type ItemRow = typeof backgroundAiBatchItems.$inferSelect;

function rowToBatch(row: BatchRow): BackgroundAiBatch {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    inputJson: row.inputJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deadlineAt: row.deadlineAt,
    error: row.error,
  };
}

function batchToRow(batch: BackgroundAiBatch): typeof backgroundAiBatches.$inferInsert {
  return {
    id: batch.id,
    type: batch.type,
    status: batch.status,
    inputJson: batch.inputJson,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    deadlineAt: batch.deadlineAt ?? undefined,
    error: batch.error ?? undefined,
  };
}

function rowToShard(row: ShardRow): BackgroundAiBatchShard {
  return {
    id: row.id,
    backgroundAiBatchId: row.backgroundAiBatchId,
    provider: row.provider,
    providerBatchId: row.providerBatchId,
    status: row.status,
    itemCount: row.itemCount,
    nextPollAt: row.nextPollAt,
    submittedAt: row.submittedAt,
    completedAt: row.completedAt,
    error: row.error,
  };
}

function shardToRow(shard: BackgroundAiBatchShard): typeof backgroundAiBatchShards.$inferInsert {
  return {
    id: shard.id,
    backgroundAiBatchId: shard.backgroundAiBatchId,
    provider: shard.provider,
    providerBatchId: shard.providerBatchId ?? undefined,
    status: shard.status,
    itemCount: shard.itemCount,
    nextPollAt: shard.nextPollAt ?? undefined,
    submittedAt: shard.submittedAt ?? undefined,
    completedAt: shard.completedAt ?? undefined,
    error: shard.error ?? undefined,
  };
}

function rowToItem(row: ItemRow): BackgroundAiBatchItem {
  return {
    id: row.id,
    backgroundAiBatchId: row.backgroundAiBatchId,
    shardId: row.shardId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    status: row.status,
    aiInputJson: row.aiInputJson,
    debugJson: row.debugJson,
    debugExpiresAt: row.debugExpiresAt,
    targetId: row.targetId,
    error: row.error,
  };
}

function itemToRow(item: BackgroundAiBatchItem): typeof backgroundAiBatchItems.$inferInsert {
  return {
    id: item.id,
    backgroundAiBatchId: item.backgroundAiBatchId,
    shardId: item.shardId ?? undefined,
    subjectType: item.subjectType,
    subjectId: item.subjectId,
    status: item.status,
    aiInputJson: item.aiInputJson,
    debugJson: item.debugJson ?? undefined,
    debugExpiresAt: item.debugExpiresAt ?? undefined,
    targetId: item.targetId ?? undefined,
    error: item.error ?? undefined,
  };
}
