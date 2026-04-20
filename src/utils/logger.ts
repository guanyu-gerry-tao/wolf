/**
 * Structured logging for wolf — backed by pino.
 *
 * Public API (what service code uses):
 *   - `log`: facade object with `debug` / `info` / `warn` / `error` methods.
 *   - `setDefaultLogger(logger)`: swap the underlying pino instance. Called
 *     once by AppContext; used by tests to install a capture stream.
 *   - `createSilentLogger()` / `createDefaultLogger()`: ready-made pino
 *     instances for tests and production.
 *
 * Why a facade over bare pino?
 *   - Lets services call `log.info('event.name', { fields })` with message
 *     first — matches the rest of our codebase and reads naturally. Pino's
 *     native API is `(fields, msg)`, which we flip inside the facade.
 *   - Lets us swap the underlying logger at runtime (test setup, capture
 *     streams) without every service needing to import `pino` directly.
 *
 * Safety in tests: Vitest sets `NODE_ENV=test` automatically. The module
 * default picks up a silent pino, so log calls from any test run produce
 * zero output and zero disk writes. Tests that want to assert on events
 * install their own pino instance backed by `pino-test`'s `sink()`.
 */
import pino, { type Logger as PinoLogger } from 'pino';

// Map our level strings to pino's level strings (they match).
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Builds a silent pino instance — every event is discarded. Used as the
 * module default so any log call that happens before setDefaultLogger
 * runs (or in a test that doesn't configure a logger) is a no-op.
 */
export function createSilentLogger(): PinoLogger {
  return pino({ level: 'silent' });
}

/**
 * Builds the production logger: level from WOLF_LOG env var (default info),
 * pretty-printed to stderr unless WOLF_LOG_FORMAT=json is set. Pass
 * `filePath` to also persist every event as JSONL.
 *
 * In tests (NODE_ENV=test), returns a silent logger instead — no matter
 * what the caller asks for. Belt-and-suspenders safety against a test
 * accidentally installing a real-sink logger.
 */
export function createDefaultLogger(options: { filePath?: string } = {}): PinoLogger {
  if (process.env.NODE_ENV === 'test') {
    return createSilentLogger();
  }

  const level = process.env.WOLF_LOG ?? 'info';
  const useJson = process.env.WOLF_LOG_FORMAT === 'json';

  // Console transport: pretty for humans (default), JSON for pipes/log-shippers.
  const consoleTransport = useJson
    ? { target: 'pino/file', options: { destination: 2 } }      // 2 = stderr fd
    : { target: 'pino-pretty', options: { destination: 2 } };

  const targets: pino.TransportTargetOptions[] = [consoleTransport];

  // File sink is optional so callers without a workspace (e.g. wolf --help)
  // can still construct a logger.
  if (options.filePath !== undefined) {
    targets.push({
      target: 'pino/file',
      options: { destination: options.filePath, mkdir: true },
      level,
    });
  }

  return pino({ level }, pino.transport({ targets }));
}

// Module-level slot holding the currently active logger. Starts silent so
// any log call that fires before setDefaultLogger has run (module-level
// init code, tests that don't configure logging) is a no-op.
let _default: PinoLogger = createSilentLogger();

/**
 * Install a new pino instance as the default. Called once by AppContext
 * at startup. Tests may call it in a test body to install a capture
 * stream; Vitest isolates module state per test file, so there's no
 * cross-file leakage.
 */
export function setDefaultLogger(logger: PinoLogger): void {
  _default = logger;
}

/** Returns the current default pino logger. Rarely needed — prefer `log`. */
export function getLogger(): PinoLogger {
  return _default;
}

/**
 * Ergonomic facade. Services import this and call e.g.
 *   log.info('tailor.pipeline.start', { jobId })
 *
 * Each method re-reads `_default` on every call so setDefaultLogger swaps
 * take effect immediately — critical for the test pattern where a test
 * installs a capture stream just before invoking the service.
 *
 * Argument order here (message, fields) is the reverse of pino's native
 * (fields, message) because message-first reads more naturally in prose.
 * The facade flips the arguments when calling through.
 */
export const log = {
  debug: (msg: string, fields?: Record<string, unknown>): void => emit('debug', msg, fields),
  info:  (msg: string, fields?: Record<string, unknown>): void => emit('info',  msg, fields),
  warn:  (msg: string, fields?: Record<string, unknown>): void => emit('warn',  msg, fields),
  error: (msg: string, fields?: Record<string, unknown>): void => emit('error', msg, fields),
};

function emit(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
  if (fields !== undefined) {
    _default[level](fields, msg);
  } else {
    _default[level](msg);
  }
}

/** Alias for consumers that want to name the type. */
export type Logger = PinoLogger;
