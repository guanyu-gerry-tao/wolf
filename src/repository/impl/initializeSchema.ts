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
  db.run(sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id                          TEXT    NOT NULL PRIMARY KEY,
      title                       TEXT    NOT NULL,
      company_id                  TEXT    NOT NULL,
      url                         TEXT    NOT NULL,
      source                      TEXT    NOT NULL,
      description                 TEXT    NOT NULL,
      location                    TEXT    NOT NULL,
      remote                      INTEGER NOT NULL,
      salary                      TEXT,
      work_authorization_required TEXT    NOT NULL,
      clearance_required          INTEGER NOT NULL,
      score                       REAL,
      score_justification         TEXT,
      status                      TEXT    NOT NULL,
      error                       TEXT,
      applied_profile_id          TEXT,
      tailored_resume_pdf_path    TEXT,
      cover_letter_html_path      TEXT,
      cover_letter_pdf_path       TEXT,
      screenshot_path             TEXT,
      outreach_draft_path         TEXT,
      created_at                  TEXT    NOT NULL,
      updated_at                  TEXT    NOT NULL
    )
  `);

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
