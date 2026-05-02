import { and, eq } from 'drizzle-orm';
import type { BatchItem, BatchItemRepository, BatchItemStatus } from '../batchItemRepository.js';
import type { DrizzleDb } from './drizzleDb.js';
import { batchItems } from './schema.js';

/** SQLite-backed repository for per-request AI batch results. */
export class SqliteBatchItemRepositoryImpl implements BatchItemRepository {
  constructor(private readonly db: DrizzleDb) {}

  /** @inheritdoc */
  async saveMany(items: BatchItem[]): Promise<void> {
    for (const item of items) {
      await this.db.insert(batchItems).values(batchItemToRow(item));
    }
  }

  /** @inheritdoc */
  async listByBatch(batchId: string): Promise<BatchItem[]> {
    const rows = await this.db
      .select()
      .from(batchItems)
      .where(eq(batchItems.batchId, batchId));
    return rows.map(rowToBatchItem);
  }

  /** @inheritdoc */
  async markSucceeded(
    batchId: string,
    customId: string,
    resultText: string,
    completedAt: string,
  ): Promise<void> {
    await this.db
      .update(batchItems)
      .set({
        status: 'succeeded',
        resultText,
        errorMessage: null,
        completedAt,
      })
      .where(and(eq(batchItems.batchId, batchId), eq(batchItems.customId, customId)));
  }

  /** @inheritdoc */
  async markFailed(
    batchId: string,
    customId: string,
    status: Exclude<BatchItemStatus, 'pending' | 'succeeded'>,
    errorMessage: string,
    completedAt: string,
  ): Promise<void> {
    await this.db
      .update(batchItems)
      .set({
        status,
        resultText: null,
        errorMessage,
        completedAt,
      })
      .where(and(eq(batchItems.batchId, batchId), eq(batchItems.customId, customId)));
  }

  /** @inheritdoc */
  async markConsumed(id: string, consumedAt: string): Promise<void> {
    await this.db
      .update(batchItems)
      .set({ consumedAt })
      .where(eq(batchItems.id, id));
  }
}

type BatchItemRow = typeof batchItems.$inferSelect;

function rowToBatchItem(row: BatchItemRow): BatchItem {
  return {
    id: row.id,
    batchId: row.batchId,
    customId: row.customId,
    status: row.status,
    resultText: row.resultText ?? null,
    errorMessage: row.errorMessage ?? null,
    consumedAt: row.consumedAt ?? null,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? null,
  };
}

function batchItemToRow(item: BatchItem): typeof batchItems.$inferInsert {
  return {
    id: item.id,
    batchId: item.batchId,
    customId: item.customId,
    status: item.status,
    resultText: item.resultText ?? undefined,
    errorMessage: item.errorMessage ?? undefined,
    consumedAt: item.consumedAt ?? undefined,
    createdAt: item.createdAt,
    completedAt: item.completedAt ?? undefined,
  };
}
