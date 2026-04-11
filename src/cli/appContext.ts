/**
 * AppContext — manual dependency injection container for wolf.
 *
 * Wires together repositories, domain services, and application services.
 * Called once per CLI invocation.
 *
 * Pattern: adapted from the `shelter.cli.AppContext` singleton in the
 * management-system-for-multi-shelter-animal-adoption reference project.
 * No DI framework, no decorators, no reflection — just plain object construction.
 *
 * Mock selection: services that wrap external APIs (Claude, etc.) fall back
 * to mock implementations when the corresponding env var is not set, so wolf
 * runs end-to-end with no keys.
 *
 * TODO(M2+): fill in real wiring as concrete implementations land.
 */

export interface AppContext {
  // repositories
  // jobRepository: JobRepository;
  // companyRepository: CompanyRepository;
  // profileRepository: ProfileRepository;
  //
  // domain services
  // rewriteService: RewriteService;
  // renderService: RenderService;
  // scoringService: ScoringService;
  //
  // application services
  // tailorApp: TailorApplicationService;
  // huntApp: HuntApplicationService;
  // scoreApp: ScoreApplicationService;
}

/**
 * Production AppContext. Reads env vars to decide real vs mock for AI-dependent services.
 */
export function createAppContext(): AppContext {
  // TODO(M2+): construct repositories from config
  // TODO(M2+): construct domain services, selecting mock if API key missing:
  //   const rewriteService = process.env.WOLF_ANTHROPIC_API_KEY
  //     ? new ClaudeRewriteService(process.env.WOLF_ANTHROPIC_API_KEY)
  //     : new MockRewriteService();
  // TODO(M2+): construct application services with injected dependencies
  return {};
}

/**
 * Test AppContext. All services are mocks, all repositories are in-memory.
 * Use in unit tests and integration tests that should not touch real files / network.
 */
export function createTestAppContext(): AppContext {
  // TODO(M2+): all-mock wiring for tests
  return {};
}
