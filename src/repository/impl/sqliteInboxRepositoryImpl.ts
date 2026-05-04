import { and, eq, sql } from 'drizzle-orm';
import type { InboxItem, InboxItemStatus, InboxRepository } from '../inboxRepository.js';
import type { DrizzleDb } from './drizzleDb.js';
import { inboxItems } from './schema.js';
import type { HuntRunInboxCapture, InboxSaveResult, ManualPageInboxCapture } from '../../utils/types/inbox.js';

export class SqliteInboxRepositoryImpl implements InboxRepository {
  constructor(private readonly db: DrizzleDb) {}

  async insert(item: InboxItem): Promise<void> {
    await this.db.insert(inboxItems).values(itemToRow(item));
  }

  async get(id: string): Promise<InboxItem | null> {
    const rows = await this.db
      .select()
      .from(inboxItems)
      .where(eq(inboxItems.id, id))
      .limit(1);
    return rows.length > 0 ? rowToItem(rows[0]) : null;
  }

  async findByRawSha256(rawSha256: string): Promise<InboxItem | null> {
    const rows = await this.db
      .select()
      .from(inboxItems)
      .where(eq(inboxItems.rawSha256, rawSha256))
      .limit(1);
    return rows.length > 0 ? rowToItem(rows[0]) : null;
  }

  async findManualPageByUrl(url: string): Promise<InboxItem | null> {
    const rows = await this.db
      .select()
      .from(inboxItems)
      .where(and(
        eq(inboxItems.kind, 'manual_page'),
        eq(inboxItems.url, url),
      ))
      .limit(1);
    return rows.length > 0 ? rowToItem(rows[0]) : null;
  }

  async listByStatus(status: InboxItemStatus, limit: number): Promise<InboxItem[]> {
    const rows = await this.db
      .select()
      .from(inboxItems)
      .where(eq(inboxItems.status, status))
      .limit(limit);
    return rows.map(rowToItem);
  }

  async countByStatus(status: InboxItemStatus): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inboxItems)
      .where(eq(inboxItems.status, status));
    return Number(row?.count ?? 0);
  }

  async updateStatus(id: string, patch: Partial<Pick<InboxItem, 'status' | 'jobId' | 'error'>>): Promise<void> {
    await this.db
      .update(inboxItems)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(inboxItems.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(inboxItems).where(eq(inboxItems.id, id));
  }

  async saveManualPage(_input: ManualPageInboxCapture): Promise<InboxSaveResult> {
    throw new Error('saveManualPage is replaced by insert() for SQLite inbox storage');
  }

  async saveHuntRun(_input: HuntRunInboxCapture): Promise<InboxSaveResult> {
    throw new Error('saveHuntRun is replaced by insert() for SQLite inbox storage');
  }
}

type InboxItemRow = typeof inboxItems.$inferSelect;

function rowToItem(row: InboxItemRow): InboxItem {
  return {
    id: row.id,
    kind: row.kind,
    source: row.source,
    url: row.url,
    title: row.title,
    rawJson: row.rawJson,
    rawSha256: row.rawSha256,
    status: row.status,
    jobId: row.jobId,
    receivedAt: row.receivedAt,
    updatedAt: row.updatedAt,
    error: row.error,
  };
}

function itemToRow(item: InboxItem): typeof inboxItems.$inferInsert {
  return {
    id: item.id,
    kind: item.kind,
    source: item.source,
    url: item.url ?? undefined,
    title: item.title ?? undefined,
    rawJson: item.rawJson,
    rawSha256: item.rawSha256,
    status: item.status,
    jobId: item.jobId ?? undefined,
    receivedAt: item.receivedAt,
    updatedAt: item.updatedAt,
    error: item.error ?? undefined,
  };
}
