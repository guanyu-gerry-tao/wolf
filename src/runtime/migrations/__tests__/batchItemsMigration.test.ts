import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { stringify } from 'smol-toml';
import { runMigrations } from '../index.js';

// Concrete migration coverage for v2 -> v3. The batch_items table is a
// workspace schema addition, so an existing v2 workspace must gain it through
// wolf migrate rather than relying only on fresh-workspace DDL.
describe('v2 to v3 batch items migration', () => {
  let tmpDir: string | null = null;

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // Existing batch metadata should survive while the new per-item table is added.
  it('creates batch_items and preserves existing batches rows', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wolf-batch-items-mig-'));
    await fs.writeFile(
      path.join(tmpDir, 'wolf.toml'),
      stringify({ schemaVersion: 2, default: 'default' }),
      'utf-8',
    );
    await fs.mkdir(path.join(tmpDir, 'data'), { recursive: true });

    const sqlite = new BetterSqlite3(path.join(tmpDir, 'data', 'wolf.sqlite'));
    sqlite.exec(`
      CREATE TABLE batches (
        id           TEXT NOT NULL PRIMARY KEY,
        batch_id     TEXT NOT NULL,
        type         TEXT NOT NULL,
        ai_provider  TEXT NOT NULL,
        profile_id   TEXT NOT NULL,
        status       TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        completed_at TEXT
      );
      INSERT INTO batches (
        id, batch_id, type, ai_provider, profile_id, status, submitted_at, completed_at
      ) VALUES (
        'batch-1', 'msgbatch_123', 'score', 'anthropic', 'default', 'pending',
        '2026-05-01T00:00:00.000Z', NULL
      );
    `);
    sqlite.close();

    await runMigrations(tmpDir);

    const migrated = new BetterSqlite3(path.join(tmpDir, 'data', 'wolf.sqlite'));
    const batchCount = migrated.prepare('SELECT count(*) AS count FROM batches').get() as { count: number };
    const itemTable = migrated
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'batch_items'")
      .get() as { name: string } | undefined;
    const batchColumns = migrated.prepare('PRAGMA table_info(batches)').all() as Array<{ name: string }>;
    migrated.close();

    expect(batchCount.count).toBe(1);
    expect(itemTable?.name).toBe('batch_items');
    expect(batchColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['model', 'error_message']),
    );
  });
});
