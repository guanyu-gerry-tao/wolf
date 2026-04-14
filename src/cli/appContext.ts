/**
 * appContext.ts — Manual dependency injection container for wolf.
 *
 * Construction order:
 *   1. Open SQLite (real path or :memory: for tests)
 *   2. Wrap with Drizzle
 *   3. initializeSchema — creates tables if not exist
 *   4. Construct repositories (each receives DrizzleDb only)
 *   5. Construct services (each receives repository interfaces only)
 *   6. Construct application services (receive repositories + services)
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
import { FileProfileRepository } from '../repository/impl/fileProfileRepository.js';
import { InMemoryProfileRepository } from '../repository/impl/inMemoryProfileRepository.js';
import { BatchServiceImpl } from '../service/impl/batchServiceImpl.js';
import { RenderServiceImpl } from '../service/impl/renderServiceImpl.js';
import { RewriteServiceImpl } from '../service/impl/rewriteServiceImpl.js';
import { TailorApplicationServiceImpl } from '../application/impl/tailorApplicationService.js';

import type { JobRepository } from '../repository/job.js';
import type { CompanyRepository } from '../repository/company.js';
import type { BatchRepository } from '../repository/batch.js';
import type { ProfileRepository } from '../repository/profile.js';
import type { BatchService } from '../service/batch.js';
import type { JobProviderService } from '../service/jobProvider.js';
import type { RenderService } from '../service/render.js';
import type { RewriteService } from '../service/rewrite.js';
import type { TailorApplicationService } from '../application/tailor.js';

export interface AppContext {
  // repositories
  jobRepository: JobRepository;
  companyRepository: CompanyRepository;
  batchRepository: BatchRepository;
  profileRepository: ProfileRepository;
  // services
  batchService: BatchService;
  jobProviders: JobProviderService[];
  renderService: RenderService;
  rewriteService: RewriteService;
  // application services
  tailorApp: TailorApplicationService;
}

/**
 * Wires repositories, services, and application services around an open SQLite connection.
 * Extracted so both createAppContext() and createTestAppContext() share the same
 * construction logic, differing only in their SQLite instance, ProfileRepository,
 * and workspaceDir.
 */
function wireContext(
  sqlite: BetterSqlite3.Database,
  profileRepository: ProfileRepository,
  workspaceDir: string,
): AppContext {
  const db = drizzle(sqlite);
  initializeSchema(db);

  const jobRepo = new SqliteJobRepository(db);
  const companyRepo = new SqliteCompanyRepository(db);
  const batchRepo = new SqliteBatchRepository(db);

  const batchService = new BatchServiceImpl(batchRepo, jobRepo);
  const renderService = new RenderServiceImpl();
  const rewriteService = new RewriteServiceImpl();
  const tailorApp = new TailorApplicationServiceImpl(
    jobRepo, profileRepository, renderService, rewriteService, workspaceDir,
  );

  return {
    jobRepository: jobRepo,
    companyRepository: companyRepo,
    batchRepository: batchRepo,
    profileRepository,
    batchService,
    jobProviders: [],
    renderService,
    rewriteService,
    tailorApp,
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
  const profileRepository = new FileProfileRepository(workspaceDir);

  return wireContext(sqlite, profileRepository, workspaceDir);
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
  const profileRepository = new InMemoryProfileRepository();
  return wireContext(sqlite, profileRepository, '/tmp/wolf-test');
}
