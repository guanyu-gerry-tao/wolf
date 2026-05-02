/**
 * appContext.ts — Manual dependency injection container for wolf.
 *
 * Construction order:
 *   1. Install the default logger (before any service is constructed)
 *   2. Open SQLite (real path or :memory: for tests)
 *   3. Wrap with Drizzle
 *   4. initializeSchema — creates tables if not exist
 *   5. Construct repositories (each receives DrizzleDb only)
 *   6. Construct services (each receives repository interfaces only)
 *   7. Construct application services (receive repositories + services)
 *
 * Swap any implementation by changing this file only.
 * No service or repository knows about this file.
 *
 * The logger is an exception to strict DI — services import `log` directly
 * from `src/utils/logger.ts` rather than receiving it as a ctor arg. Keeps
 * service signatures focused on their domain dependencies while still
 * allowing tests to swap the default with `setDefaultLogger(memoryLogger)`.
 */

import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { initializeSchema } from '../repository/impl/initializeSchema.js';
import { SqliteJobRepositoryImpl } from '../repository/impl/sqliteJobRepositoryImpl.js';
import { SqliteCompanyRepositoryImpl } from '../repository/impl/sqliteCompanyRepositoryImpl.js';
import { SqliteBatchRepositoryImpl } from '../repository/impl/sqliteBatchRepositoryImpl.js';
import { SqliteBatchItemRepositoryImpl } from '../repository/impl/sqliteBatchItemRepositoryImpl.js';
import { FileProfileRepositoryImpl } from '../repository/impl/fileProfileRepositoryImpl.js';
import { InMemoryProfileRepositoryImpl } from '../repository/impl/inMemoryProfileRepositoryImpl.js';
import { BatchServiceImpl } from '../service/impl/batchServiceImpl.js';
import { RenderServiceImpl } from '../service/impl/renderServiceImpl.js';
import { ResumeCoverLetterServiceImpl } from '../service/impl/resumeCoverLetterServiceImpl.js';
import { TailoringBriefServiceImpl } from '../service/impl/tailoringBriefServiceImpl.js';
import { StagehandFillServiceImpl } from '../service/impl/stagehandFillServiceImpl.js';
import { StatusApplicationServiceImpl } from '../application/impl/statusApplicationServiceImpl.js';
import { TailorApplicationServiceImpl } from '../application/impl/tailorApplicationServiceImpl.js';
import { AddApplicationServiceImpl } from '../application/impl/addApplicationServiceImpl.js';
import { ConfigApplicationServiceImpl } from '../application/impl/configApplicationServiceImpl.js';
import { EnvApplicationServiceImpl } from '../application/impl/envApplicationServiceImpl.js';
import { ProfileApplicationServiceImpl } from '../application/impl/profileApplicationServiceImpl.js';
import { DoctorApplicationServiceImpl } from '../application/impl/doctorApplicationServiceImpl.js';
import { InitApplicationServiceImpl } from '../application/impl/initApplicationServiceImpl.js';
import { JobApplicationServiceImpl } from '../application/impl/jobApplicationServiceImpl.js';
import { HuntApplicationServiceImpl } from '../application/impl/huntApplicationServiceImpl.js';
import { ScoreApplicationServiceImpl } from '../application/impl/scoreApplicationServiceImpl.js';
import { FillApplicationServiceImpl } from '../application/impl/fillApplicationServiceImpl.js';
import { ReachApplicationServiceImpl } from '../application/impl/reachApplicationServiceImpl.js';
import { ContextApplicationServiceImpl } from '../application/impl/contextApplicationServiceImpl.js';
import { ServeApplicationServiceImpl } from '../application/impl/serveApplicationServiceImpl.js';
import { InboxApplicationServiceImpl } from '../application/impl/inboxApplicationServiceImpl.js';
import { InboxPromotionApplicationServiceImpl } from '../application/impl/inboxPromotionApplicationServiceImpl.js';
import { BackgroundAiBatchWorkerImpl } from '../application/impl/backgroundAiBatchWorkerImpl.js';
import { RunStatusApplicationServiceImpl } from '../application/impl/runStatusApplicationServiceImpl.js';
import { ArtifactApplicationServiceImpl } from '../application/impl/artifactApplicationServiceImpl.js';
import { CompanionActionApplicationServiceImpl } from '../application/impl/companionActionApplicationServiceImpl.js';
import { FillServiceImpl } from '../service/impl/fillServiceImpl.js';
import { SqliteInboxRepositoryImpl } from '../repository/impl/sqliteInboxRepositoryImpl.js';
import { SqliteBackgroundAiBatchRepositoryImpl } from '../repository/impl/sqliteBackgroundAiBatchRepositoryImpl.js';
import { NodeHttpServerImpl } from '../serve/impl/nodeHttpServerImpl.js';
import { PlaywrightBrowserManagerImpl } from '../serve/impl/playwrightBrowserManagerImpl.js';
import { loadConfigSync } from '../utils/config.js';
import { resolveWorkspaceDir } from '../utils/instance.js';
import { createDefaultLogger, createSilentLogger, setDefaultLogger } from '../utils/logger.js';
import { parseModelRef } from '../utils/parseModelRef.js';
import { WOLF_VERSION } from '../utils/version.js';

import type { JobRepository } from '../repository/jobRepository.js';
import type { CompanyRepository } from '../repository/companyRepository.js';
import type { BatchRepository } from '../repository/batchRepository.js';
import type { BatchItemRepository } from '../repository/batchItemRepository.js';
import type { BackgroundAiBatchRepository } from '../repository/backgroundAiBatchRepository.js';
import type { InboxRepository } from '../repository/inboxRepository.js';
import type { ProfileRepository } from '../repository/profileRepository.js';
import type { BatchService } from '../service/batchService.js';
import type { JobProvider } from '../service/jobProvider.js';
import type { RenderService } from '../service/renderService.js';
import type { ResumeCoverLetterService } from '../service/resumeCoverLetterService.js';
import type { TailoringBriefService } from '../service/tailoringBriefService.js';
import type { StagehandFillService } from '../service/stagehandFillService.js';
import type {
  StatusApplicationService,
  StatusCounter,
} from '../application/statusApplicationService.js';
import type { TailorApplicationService } from '../application/tailorApplicationService.js';
import type { AddApplicationService } from '../application/addApplicationService.js';
import type { ConfigApplicationService } from '../application/configApplicationService.js';
import type { EnvApplicationService } from '../application/envApplicationService.js';
import type { ProfileApplicationService } from '../application/profileApplicationService.js';
import type { DoctorApplicationService } from '../application/doctorApplicationService.js';
import type { InitApplicationService } from '../application/initApplicationService.js';
import type { JobApplicationService } from '../application/jobApplicationService.js';
import type { HuntApplicationService } from '../application/huntApplicationService.js';
import type { ScoreApplicationService } from '../application/scoreApplicationService.js';
import type { FillApplicationService } from '../application/fillApplicationService.js';
import type { ReachApplicationService } from '../application/reachApplicationService.js';
import type { ContextApplicationService } from '../application/contextApplicationService.js';
import type { InboxApplicationService } from '../application/inboxApplicationService.js';
import type { InboxPromotionApplicationService } from '../application/inboxPromotionApplicationService.js';
import type { BackgroundAiBatchWorker } from '../application/backgroundAiBatchWorker.js';
import type { RunStatusApplicationService } from '../application/runStatusApplicationService.js';
import type { ArtifactApplicationService } from '../application/artifactApplicationService.js';
import type { CompanionActionApplicationService } from '../application/companionActionApplicationService.js';
import type { FillService } from '../service/fillService.js';
import type { ServeBrowserManager } from '../serve/browserManager.js';
import type { ServeApplicationService } from '../application/serveApplicationService.js';
import type { HttpServer } from '../serve/httpServer.js';
import type { AiConfig } from '../utils/types/index.js';

export interface AppContext {
  // repositories
  jobRepository: JobRepository;
  companyRepository: CompanyRepository;
  batchRepository: BatchRepository;
  batchItemRepository: BatchItemRepository;
  backgroundAiBatchRepository: BackgroundAiBatchRepository;
  inboxRepository: InboxRepository;
  profileRepository: ProfileRepository;
  // services
  batchService: BatchService;
  jobProviders: JobProvider[];
  renderService: RenderService;
  rewriteService: ResumeCoverLetterService;
  briefService: TailoringBriefService;
  stagehandFillService: StagehandFillService;
  httpServer: HttpServer;
  // application services
  tailorApp: TailorApplicationService;
  statusApp: StatusApplicationService;
  addApp: AddApplicationService;
  configApp: ConfigApplicationService;
  envApp: EnvApplicationService;
  profileApp: ProfileApplicationService;
  doctorApp: DoctorApplicationService;
  initApp: InitApplicationService;
  jobApp: JobApplicationService;
  huntApp: HuntApplicationService;
  scoreApp: ScoreApplicationService;
  fillApp: FillApplicationService;
  reachApp: ReachApplicationService;
  contextApp: ContextApplicationService;
  inboxApp: InboxApplicationService;
  inboxPromotionApp: InboxPromotionApplicationService;
  backgroundAiBatchWorker: BackgroundAiBatchWorker;
  runStatusApp: RunStatusApplicationService;
  artifactApp: ArtifactApplicationService;
  companionActionApp: CompanionActionApplicationService;
  browserManager: ServeBrowserManager;
  serveApp: ServeApplicationService;
  fillService: FillService;
  // config
  defaultAiConfig: AiConfig;
}

/**
 * Wires repositories, services, and application services around an open SQLite connection.
 * Extracted so both createAppContext() and createTestAppContext() share the same
 * construction logic, differing only in their SQLite instance, ProfileRepository,
 * workspaceDir, and defaultAiConfig. The default logger must already be installed
 * before calling this.
 */
function wireContext(
  sqlite: BetterSqlite3.Database,
  profileRepository: ProfileRepository,
  workspaceDir: string,
  defaultAiConfig: AiConfig,
): AppContext {
  const db = drizzle(sqlite);
  initializeSchema(db);

  // Order matters: jobRepo depends on companyRepo to resolve company names
  // when composing `data/jobs/<name>_<title>_<shortId>/` paths.
  const companyRepo = new SqliteCompanyRepositoryImpl(db, workspaceDir);
  const jobRepo = new SqliteJobRepositoryImpl(db, companyRepo, workspaceDir);
  const batchRepo = new SqliteBatchRepositoryImpl(db);
  const batchItemRepo = new SqliteBatchItemRepositoryImpl(db);
  const backgroundAiBatchRepo = new SqliteBackgroundAiBatchRepositoryImpl(db);
  const inboxRepo = new SqliteInboxRepositoryImpl(db);

  // Services don't take `logger` through constructors — they import the `log`
  // facade directly from src/utils/logger.ts. The default logger was installed
  // via setDefaultLogger() in createAppContext / createTestAppContext before
  // we got here.
  const batchService = new BatchServiceImpl(batchRepo, batchItemRepo, jobRepo);
  const renderService = new RenderServiceImpl();
  const rewriteService = new ResumeCoverLetterServiceImpl();
  const briefService = new TailoringBriefServiceImpl();
  const stagehandFillService = new StagehandFillServiceImpl();
  const tailorApp = new TailorApplicationServiceImpl(
    jobRepo, profileRepository, renderService, rewriteService, briefService,
    defaultAiConfig,
  );

  // Each entry here is one module's contribution to the `wolf status`
  // dashboard. Adding a feature (hunt, fill, reach) = add one entry; the
  // command and service layers don't change. See docs/design/DECISIONS.md
  // "Nouns over god-views" (2026-04-18).
  const statusCounters: StatusCounter[] = [
    { label: 'tracked',  count: () => jobRepo.countAll() },
    { label: 'tailored', count: () => jobRepo.countWithTailoredResume() },
    { label: 'applied',  count: async () => (await jobRepo.countByStatus()).applied },
  ];
  const statusApp = new StatusApplicationServiceImpl(statusCounters);
  const addApp = new AddApplicationServiceImpl(jobRepo, companyRepo);
  const inboxApp = new InboxApplicationServiceImpl(inboxRepo);
  const inboxPromotionApp = new InboxPromotionApplicationServiceImpl(inboxRepo, backgroundAiBatchRepo, addApp);
  const backgroundAiBatchWorker = new BackgroundAiBatchWorkerImpl(backgroundAiBatchRepo);
  const artifactApp = new ArtifactApplicationServiceImpl(jobRepo);
  const companionActionApp = new CompanionActionApplicationServiceImpl(
    tailorApp, jobRepo, profileRepository, stagehandFillService,
  );
  const runStatusApp = new RunStatusApplicationServiceImpl(backgroundAiBatchRepo, companionActionApp);
  const browserManager = new PlaywrightBrowserManagerImpl(
    path.join(workspaceDir, 'data', 'wolf-browser-profile'),
    // TODO(companion-onboarding): Wire this to the wolf wiki/onboarding URL
    // once the first-run flow is ready. Keep null for now so serve only opens
    // the browser profile and does not surprise users with a page navigation.
    null,
  );
  const configApp = new ConfigApplicationServiceImpl();
  const envApp = new EnvApplicationServiceImpl();
  const profileApp = new ProfileApplicationServiceImpl();
  const doctorApp = new DoctorApplicationServiceImpl(profileRepository);
  const initApp = new InitApplicationServiceImpl();
  const jobApp = new JobApplicationServiceImpl(jobRepo, companyRepo);
  const httpServer = new NodeHttpServerImpl({
    version: WOLF_VERSION,
    workspacePath: workspaceDir,
    inboxApp,
    inboxPromotionApp,
    runStatusApp,
    artifactApp,
    companionActionApp,
    browserManager,
    jobApp,
    statusApp,
    configApp,
    profileApp,
    jobRepository: jobRepo,
    companyRepository: companyRepo,
  });
  const huntApp = new HuntApplicationServiceImpl();
  const scoreApp = new ScoreApplicationServiceImpl();
  const fillApp = new FillApplicationServiceImpl();
  const reachApp = new ReachApplicationServiceImpl();
  const contextApp = new ContextApplicationServiceImpl(profileRepository);
  const serveApp = new ServeApplicationServiceImpl(httpServer, backgroundAiBatchWorker, browserManager);
  const fillService = new FillServiceImpl();

  return {
    jobRepository: jobRepo,
    companyRepository: companyRepo,
    batchRepository: batchRepo,
    batchItemRepository: batchItemRepo,
    backgroundAiBatchRepository: backgroundAiBatchRepo,
    inboxRepository: inboxRepo,
    profileRepository,
    batchService,
    jobProviders: [],
    renderService,
    rewriteService,
    briefService,
    stagehandFillService,
    httpServer,
    tailorApp,
    statusApp,
    addApp,
    configApp,
    envApp,
    profileApp,
    doctorApp,
    initApp,
    jobApp,
    huntApp,
    scoreApp,
    fillApp,
    reachApp,
    contextApp,
    inboxApp,
    inboxPromotionApp,
    backgroundAiBatchWorker,
    runStatusApp,
    artifactApp,
    companionActionApp,
    browserManager,
    serveApp,
    fillService,
    defaultAiConfig,
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
  const workspaceDir = resolveWorkspaceDir();
  const dataDir = path.join(workspaceDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // Install the real pino logger into the module slot BEFORE constructing
  // any service. Pretty console output to stderr (or JSON when
  // WOLF_LOG_FORMAT=json is set) and an always-on JSONL file sink under
  // data/logs/wolf.log.jsonl. Level comes from WOLF_LOG (default info).
  setDefaultLogger(createDefaultLogger({
    filePath: path.join(dataDir, 'logs', 'wolf.log.jsonl'),
  }));

  const dbPath = path.join(dataDir, 'wolf.sqlite');
  const sqlite = new BetterSqlite3(dbPath);
  const profileRepository = new FileProfileRepositoryImpl(workspaceDir);

  // Load config synchronously so default-parameter pattern in commands works.
  const config = loadConfigSync();
  const defaultAiConfig: AiConfig = parseModelRef(config.tailor.model);

  return wireContext(
    sqlite, profileRepository, workspaceDir, defaultAiConfig,
  );
}

/**
 * Test AppContext.
 *
 * Uses an in-memory SQLite database — no files are created. The default
 * logger is reset to silent so test output stays clean.
 */
export function createTestAppContext(): AppContext {
  // Every test context starts silent. Individual tests that want to
  // capture events override this with setDefaultLogger(memoryLogger) in
  // their beforeEach, and restore it in afterEach.
  setDefaultLogger(createSilentLogger());

  const sqlite = new BetterSqlite3(':memory:');
  const profileRepository = new InMemoryProfileRepositoryImpl();
  const defaultAiConfig: AiConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };
  return wireContext(
    sqlite, profileRepository, '/tmp/wolf-test', defaultAiConfig,
  );
}
