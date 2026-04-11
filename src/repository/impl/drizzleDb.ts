/**
 * drizzleDb.ts — Shared type alias for the Drizzle database handle.
 *
 * All repositories accept `DrizzleDb` via their constructor.
 * AppContext constructs a single instance and passes it to every repo.
 */
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export type DrizzleDb = BetterSQLite3Database;
