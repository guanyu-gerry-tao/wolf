import { eq } from 'drizzle-orm';
import type { BatchRepository, Batch } from '../batchRepository.js';
import type { DrizzleDb } from './drizzleDb.js';
import { batches } from './schema.js';

/**
 * Drizzle/SQLite-backed `BatchRepository`. Stores AI batch metadata in the
 * `batches` table; pending rows survive process restarts so polling can
 * resume after a crash.
 */
export class SqliteBatchRepositoryImpl implements BatchRepository {
  constructor(private readonly db: DrizzleDb) {}

  /** @inheritdoc */
  async save(batch: Batch): Promise<void> {
    await this.db.insert(batches).values(batchToRow(batch));
  }

  /** @inheritdoc */
  async get(id: string): Promise<Batch | null> {
    const rows = await this.db
      .select()
      .from(batches)
      .where(eq(batches.id, id))
      .limit(1);
    return rows[0] ? rowToBatch(rows[0]) : null;
  }

  /** @inheritdoc */
  async getPending(): Promise<Batch[]> {
    const rows = await this.db
      .select()
      .from(batches)
      .where(eq(batches.status, 'pending'));
    return rows.map(rowToBatch);
  }

  /** @inheritdoc */
  async markComplete(id: string, completedAt: string): Promise<void> {
    await this.db
      .update(batches)
      .set({ status: 'completed', completedAt })
      .where(eq(batches.id, id));
  }

  /** @inheritdoc */
  async markFailed(id: string, errorMessage?: string): Promise<void> {
    await this.db
      .update(batches)
      .set({ status: 'failed', errorMessage: errorMessage ?? undefined })
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
    model: row.model ?? null,
    profileId: row.profileId,
    status: row.status,
    errorMessage: row.errorMessage ?? null,
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
    model: batch.model ?? undefined,
    profileId: batch.profileId,
    status: batch.status,
    errorMessage: batch.errorMessage ?? undefined,
    submittedAt: batch.submittedAt,
    completedAt: batch.completedAt ?? undefined,
  };
}
