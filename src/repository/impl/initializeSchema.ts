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
      salary_low                  TEXT,
      salary_high                 REAL,
      work_authorization_required TEXT    NOT NULL,
      clearance_required          INTEGER NOT NULL,
      description_md              TEXT    NOT NULL DEFAULT '',
      score                       REAL,
      score_justification         TEXT,
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

  // ---------------------------------------------------------------------------
  // batches
  // ---------------------------------------------------------------------------
  db.run(sql`
    CREATE TABLE IF NOT EXISTS batches (
      id           TEXT NOT NULL PRIMARY KEY,
      batch_id     TEXT NOT NULL,
      type         TEXT NOT NULL,
      ai_provider  TEXT NOT NULL,
      profile_id   TEXT NOT NULL,
      status       TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      completed_at TEXT
    )
  `);
}
