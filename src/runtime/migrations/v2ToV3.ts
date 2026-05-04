import path from 'node:path';
import fs from 'node:fs';
import BetterSqlite3 from 'better-sqlite3';
import { log } from '../../utils/logger.js';
import type { Migration } from './index.js';

/** v2 -> v3 adds durable per-request AI batch result rows. */
export const v2ToV3: Migration = {
  fromVersion: 2,
  toVersion: 3,
  description: 'Add batch_items table for durable per-request AI batch results.',
  run: async (workspaceDir: string) => {
    const dataDir = path.join(workspaceDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    const sqlite = new BetterSqlite3(path.join(dataDir, 'wolf.sqlite'));
    try {
      try {
        sqlite.exec('ALTER TABLE batches ADD COLUMN model TEXT');
      } catch {
        /* column already present — nothing to do */
      }

      try {
        sqlite.exec('ALTER TABLE batches ADD COLUMN error_message TEXT');
      } catch {
        /* column already present — nothing to do */
      }

      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS batch_items (
          id            TEXT NOT NULL PRIMARY KEY,
          batch_id      TEXT NOT NULL,
          custom_id     TEXT NOT NULL,
          status        TEXT NOT NULL,
          result_text   TEXT,
          error_message TEXT,
          consumed_at   TEXT,
          created_at    TEXT NOT NULL,
          completed_at  TEXT
        )
      `);
      log.info('migrate.v2tov3.batch_items.created', { workspaceDir });
    } finally {
      sqlite.close();
    }
  },
};
