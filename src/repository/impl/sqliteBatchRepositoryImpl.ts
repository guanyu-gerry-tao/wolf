import { eq } from 'drizzle-orm';
import type { BatchRepository, Batch } from '../batchRepository.js';
import type { DrizzleDb } from './drizzleDb.js';
import { batches } from './schema.js';

export class SqliteBatchRepositoryImpl implements BatchRepository {
  constructor(private readonly db: DrizzleDb) {}

  async save(batch: Batch): Promise<void> {
    await this.db.insert(batches).values(batchToRow(batch));
  }

  async getPending(): Promise<Batch[]> {
    const rows = await this.db
      .select()
      .from(batches)
      .where(eq(batches.status, 'pending'));
    return rows.map(rowToBatch);
  }

  async markComplete(id: string, completedAt: string): Promise<void> {
    await this.db
      .update(batches)
      .set({ status: 'completed', completedAt })
      .where(eq(batches.id, id));
  }

  async markFailed(id: string): Promise<void> {
    await this.db
      .update(batches)
      .set({ status: 'failed' })
      .where(eq(batches.id, id));
  }
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

type BatchRow = typeof batches.$inferSelect;

function rowToBatch(row: BatchRow): Batch {
  return {
    id: row.id,
    batchId: row.batchId,
    type: row.type,
    aiProvider: row.aiProvider,
    profileId: row.profileId,
    status: row.status,
    submittedAt: row.submittedAt,
    completedAt: row.completedAt ?? null,
  };
}

function batchToRow(batch: Batch): typeof batches.$inferInsert {
  return {
    id: batch.id,
    batchId: batch.batchId,
    type: batch.type,
    aiProvider: batch.aiProvider,
    profileId: batch.profileId,
    status: batch.status,
    submittedAt: batch.submittedAt,
    completedAt: batch.completedAt ?? undefined,
  };
}
