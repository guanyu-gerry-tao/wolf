/**
 * initializeSchema.ts — Centralized DDL for all SQLite tables.
 *
 * This is the ONLY place in the codebase that contains CREATE TABLE statements.
 * Called once by AppContext at startup before any repository is used.
 * No repository constructor may contain DDL.
 */
import { sql } from 'drizzle-orm';
import type { DrizzleDb } from './drizzleDb.js';

export function initializeSchema(db: DrizzleDb): void {
  // ---------------------------------------------------------------------------
  // companies
  // ---------------------------------------------------------------------------
  db.run(sql`
    CREATE TABLE IF NOT EXISTS companies (
      id                    TEXT    NOT NULL PRIMARY KEY,
      name                  TEXT    NOT NULL,
      domain                TEXT,
      linkedin_url          TEXT,
      size                  TEXT,
      industry              TEXT,
      headquarters_location TEXT,
      notes                 TEXT,
      created_at            TEXT    NOT NULL,
      updated_at            TEXT    NOT NULL
    )
  `);

  // ---------------------------------------------------------------------------
  // jobs
  // ---------------------------------------------------------------------------
  // v2 added `description_md` so the JD prose lives in SQLite alongside the
  // structured metadata (no more `data/jobs/<dir>/jd.md`). Existing v1 SQLite
  // files get the column added by the v1→v2 migration via ALTER TABLE.
  db.run(sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id                          TEXT    NOT NULL PRIMARY KEY,
      title                       TEXT    NOT NULL,
      company_id                  TEXT    NOT NULL,
      url                         TEXT    NOT NULL,
      source                      TEXT    NOT NULL,
      location                    TEXT    NOT NULL,
      remote                      INTEGER NOT NULL,
      salary_low                  REAL,
      salary_high                 REAL,
      work_authorization_required TEXT    NOT NULL,
      clearance_required          INTEGER NOT NULL,
      description_md              TEXT    NOT NULL DEFAULT '',
      score                       REAL,
      score_justification         TEXT,
      tier_ai                     INTEGER,
      tier_user                   INTEGER,
      status                      TEXT    NOT NULL,
      error                       TEXT,
      applied_profile_id          TEXT,
      has_tailored_resume         INTEGER NOT NULL DEFAULT 0,
      has_tailored_cover_letter   INTEGER NOT NULL DEFAULT 0,
      has_screenshots             INTEGER NOT NULL DEFAULT 0,
      has_outreach_draft          INTEGER NOT NULL DEFAULT 0,
      created_at                  TEXT    NOT NULL,
      updated_at                  TEXT    NOT NULL
    )
  `);

  // ALTER TABLE for upgrades: adds `description_md` to existing jobs tables
  // that pre-date v2. Wrapped in try/catch because SQLite throws if the
  // column already exists, and there's no IF NOT EXISTS variant for ADD
  // COLUMN. Idempotent at the runtime level.
  try {
    db.run(sql`ALTER TABLE jobs ADD COLUMN description_md TEXT NOT NULL DEFAULT ''`);
  } catch {
    /* column already present — nothing to do */
  }

  // v3 added tier_ai / tier_user for tier-based scoring. ALTER TABLE for
  // upgrades; safe-to-fail when columns already exist.
  try {
    db.run(sql`ALTER TABLE jobs ADD COLUMN tier_ai INTEGER`);
  } catch {
    /* column already present — nothing to do */
  }
  try {
    db.run(sql`ALTER TABLE jobs ADD COLUMN tier_user INTEGER`);
  } catch {
    /* column already present — nothing to do */
  }

  // ---------------------------------------------------------------------------
  // batches
  // ---------------------------------------------------------------------------
  db.run(sql`
    CREATE TABLE IF NOT EXISTS batches (
      id           TEXT NOT NULL PRIMARY KEY,
      batch_id     TEXT NOT NULL,
      type         TEXT NOT NULL,
      ai_provider  TEXT NOT NULL,
      model        TEXT,
      profile_id   TEXT NOT NULL,
      status       TEXT NOT NULL,
      error_message TEXT,
      submitted_at TEXT NOT NULL,
      completed_at TEXT
    )
  `);

  try {
    db.run(sql`ALTER TABLE batches ADD COLUMN model TEXT`);
  } catch {
    /* column already present — nothing to do */
  }

  try {
    db.run(sql`ALTER TABLE batches ADD COLUMN error_message TEXT`);
  } catch {
    /* column already present — nothing to do */
  }

  db.run(sql`
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

  // ---------------------------------------------------------------------------
  // inbox_items
  // ---------------------------------------------------------------------------
  db.run(sql`
    CREATE TABLE IF NOT EXISTS inbox_items (
      id          TEXT NOT NULL PRIMARY KEY,
      kind        TEXT NOT NULL,
      source      TEXT NOT NULL,
      url         TEXT,
      title       TEXT,
      raw_json    TEXT NOT NULL,
      raw_sha256  TEXT NOT NULL,
      status      TEXT NOT NULL,
      job_id      TEXT,
      received_at TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      error       TEXT
    )
  `);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_inbox_items_status ON inbox_items(status)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_inbox_items_url ON inbox_items(url)`);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_items_raw_sha256 ON inbox_items(raw_sha256)`);

  // ---------------------------------------------------------------------------
  // background_ai_batches
  // ---------------------------------------------------------------------------
  db.run(sql`
    CREATE TABLE IF NOT EXISTS background_ai_batches (
      id          TEXT NOT NULL PRIMARY KEY,
      type        TEXT NOT NULL,
      status      TEXT NOT NULL,
      input_json  TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      deadline_at TEXT,
      error       TEXT
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS background_ai_batch_shards (
      id                     TEXT    NOT NULL PRIMARY KEY,
      background_ai_batch_id TEXT    NOT NULL,
      provider               TEXT    NOT NULL,
      provider_batch_id      TEXT,
      status                 TEXT    NOT NULL,
      item_count             INTEGER NOT NULL,
      next_poll_at           TEXT,
      submitted_at           TEXT,
      completed_at           TEXT,
      error                  TEXT,
      FOREIGN KEY(background_ai_batch_id) REFERENCES background_ai_batches(id)
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS background_ai_batch_items (
      id                     TEXT NOT NULL PRIMARY KEY,
      background_ai_batch_id TEXT NOT NULL,
      shard_id               TEXT,
      subject_type           TEXT NOT NULL,
      subject_id             TEXT NOT NULL,
      status                 TEXT NOT NULL,
      ai_input_json          TEXT NOT NULL,
      debug_json             TEXT,
      debug_expires_at       TEXT,
      target_id              TEXT,
      error                  TEXT,
      FOREIGN KEY(background_ai_batch_id) REFERENCES background_ai_batches(id),
      FOREIGN KEY(shard_id) REFERENCES background_ai_batch_shards(id)
    )
  `);
}
