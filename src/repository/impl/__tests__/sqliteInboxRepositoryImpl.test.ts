import { describe, expect, it } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initializeSchema } from '../initializeSchema.js';
import { SqliteInboxRepositoryImpl } from '../sqliteInboxRepositoryImpl.js';
import type { InboxItem } from '../../inboxRepository.js';

// SQLite inbox stores raw source payloads and lightweight processing state.
describe('SqliteInboxRepositoryImpl', () => {
  function makeRepo(): SqliteInboxRepositoryImpl {
    const sqlite = new BetterSqlite3(':memory:');
    const db = drizzle(sqlite);
    initializeSchema(db);
    return new SqliteInboxRepositoryImpl(db);
  }

  function makeItem(overrides: Partial<InboxItem> = {}): InboxItem {
    return {
      id: 'inbox-1',
      kind: 'manual_page',
      source: 'wolf_companion',
      url: 'https://example.com/jobs/1',
      title: 'Software Engineer',
      rawJson: '{"html":"<html></html>"}',
      rawSha256: 'sha256-a',
      status: 'raw',
      jobId: null,
      receivedAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      error: null,
      ...overrides,
    };
  }

  // Raw manual pages should round-trip exactly as SQLite rows, including their
  // raw payload and status.
  it('inserts and lists raw inbox items by status', async () => {
    const repo = makeRepo();
    await repo.insert(makeItem());

    const rows = await repo.listByStatus('raw', 25);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'inbox-1',
      kind: 'manual_page',
      source: 'wolf_companion',
      status: 'raw',
      rawJson: '{"html":"<html></html>"}',
    });
    await expect(repo.findByRawSha256('sha256-a')).resolves.toMatchObject({ id: 'inbox-1' });
    await expect(repo.findManualPageByUrl('https://example.com/jobs/1')).resolves.toMatchObject({
      id: 'inbox-1',
    });
  });

  // raw_sha256 is the deterministic dedupe key. Duplicate raw payloads should
  // not create two queue entries.
  it('rejects duplicate raw hashes', async () => {
    const repo = makeRepo();
    await repo.insert(makeItem({ id: 'inbox-1', rawSha256: 'same' }));

    await expect(repo.insert(makeItem({ id: 'inbox-2', rawSha256: 'same' }))).rejects.toThrow();
  });

  // Processing state changes live on the inbox row, not as sidecar files.
  it('updates inbox item status, job id, and error', async () => {
    const repo = makeRepo();
    await repo.insert(makeItem());

    await repo.updateStatus('inbox-1', { status: 'promoted', jobId: 'job-1', error: null });
    const rows = await repo.listByStatus('promoted', 25);

    expect(rows[0]).toMatchObject({
      id: 'inbox-1',
      status: 'promoted',
      jobId: 'job-1',
      error: null,
    });
  });

  // Accidental companion imports can be removed from the inbox before paid
  // processing. This does not touch any jobs table rows.
  it('deletes inbox items by id', async () => {
    const repo = makeRepo();
    await repo.insert(makeItem());

    await repo.delete('inbox-1');

    await expect(repo.findByRawSha256('sha256-a')).resolves.toBeNull();
  });
});
