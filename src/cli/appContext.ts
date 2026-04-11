/**
 * appContext.ts — Manual dependency injection container for wolf.
 *
 * Construction order:
 *   1. Open SQLite (real path or :memory: for tests)
 *   2. Wrap with Drizzle
 *   3. initializeSchema — creates tables if not exist
 *   4. Construct repositories (each receives DrizzleDb only)
 *   5. Construct services (each receives repository interfaces only)
 *
 * Swap any implementation by changing this file only.
 * No service or repository knows about this file.
 */

import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { initializeSchema } from '../repository/impl/initializeSchema.js';
import { SqliteJobRepository } from '../repository/impl/sqliteJobRepository.js';
import { SqliteCompanyRepository } from '../repository/impl/sqliteCompanyRepository.js';
import { SqliteBatchRepository } from '../repository/impl/sqliteBatchRepository.js';
import { BatchServiceImpl } from '../service/impl/batchServiceImpl.js';

import type { JobRepository } from '../repository/job.js';
import type { CompanyRepository } from '../repository/company.js';
import type { BatchRepository } from '../repository/batch.js';
import type { BatchService } from '../service/batch.js';
import type { JobProviderService } from '../service/jobProvider.js';

export interface AppContext {
  // repositories
  jobRepository: JobRepository;
  companyRepository: CompanyRepository;
  batchRepository: BatchRepository;
  // services
  batchService: BatchService;
  jobProviders: JobProviderService[];
  // application services — TODO: add as M3+ implementations land
}

/**
 * Wires repositories and services around an open SQLite connection.
 * Extracted so both createAppContext() and createTestAppContext() share the
 * same construction logic, differing only in which SQLite instance they open.
 */
function wireContext(sqlite: BetterSqlite3.Database): AppContext {
  const db = drizzle(sqlite);
  initializeSchema(db);

  const jobRepo = new SqliteJobRepository(db);
  const companyRepo = new SqliteCompanyRepository(db);
  const batchRepo = new SqliteBatchRepository(db);

  const batchService = new BatchServiceImpl(batchRepo, jobRepo);

  return {
    jobRepository: jobRepo,
    companyRepository: companyRepo,
    batchRepository: batchRepo,
    batchService,
    jobProviders: [], // loading provider config from wolf.toml is M3+ work
  };
}

/**
 * Production AppContext.
 *
 * Reads workspaceDir from process.cwd() (the same convention used by
 * src/utils/config.ts — wolf.toml is always expected at process.cwd()).
 * Creates the data/ sub-directory if it does not yet exist, then opens
 * wolf.sqlite inside it.
 */
export function createAppContext(): AppContext {
  const workspaceDir = process.cwd();
  const dataDir = path.join(workspaceDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, 'wolf.sqlite');
  const sqlite = new BetterSqlite3(dbPath);

  return wireContext(sqlite);
}

/**
 * Test AppContext.
 *
 * Uses an in-memory SQLite database — no files are created.
 * Use in unit tests and integration tests that should not touch real files or
 * the network.
 */
export function createTestAppContext(): AppContext {
  const sqlite = new BetterSqlite3(':memory:');
  return wireContext(sqlite);
}
