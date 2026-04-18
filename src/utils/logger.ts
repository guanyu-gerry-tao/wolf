/**
 * Structured logger for wolf.
 *
 * Design:
 *   - Four levels: debug / info / warn / error.
 *   - All events are structured: (msg: string, fields?: Record<string, unknown>).
 *   - Sinks decide where events go; renderers decide how they look.
 *   - Console sink writes to stderr — stdout is reserved for command deliverables
 *     (parseable output, JSON payloads, MCP protocol frames).
 *   - File sink always writes JSONL — one event per line, grep/jq-friendly.
 *
 * Level filter:
 *   - WOLF_LOG=debug|info|warn|error (default: info).
 *   - Events below the threshold are dropped before any sink sees them.
 *
 * Format (console only):
 *   - WOLF_LOG_FORMAT=pretty|json (default: pretty).
 *   - File sink is always json — mixing rendered text and structured data is pointless.
 *
 * Testing:
 *   - createMemorySink() captures events in memory for assertions.
 *   - createSilentLogger() discards everything — for test AppContexts.
 */
import fs from 'node:fs';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export interface LogSink {
  write(event: LogEvent): void;
}

export interface CreateLoggerOptions {
  level?: LogLevel;
  sinks?: LogSink[];
}

// Level ordering — events below the logger's threshold are silently dropped.
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class LoggerImpl implements Logger {
  constructor(
    private level: LogLevel,
    private sinks: LogSink[],
  ) {}

  debug(msg: string, fields?: Record<string, unknown>): void {
    this.emit('debug', msg, fields);
  }
  info(msg: string, fields?: Record<string, unknown>): void {
    this.emit('info', msg, fields);
  }
  warn(msg: string, fields?: Record<string, unknown>): void {
    this.emit('warn', msg, fields);
  }
  error(msg: string, fields?: Record<string, unknown>): void {
    this.emit('error', msg, fields);
  }

  private emit(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const event: LogEvent = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...(fields ?? {}),
    };
    for (const sink of this.sinks) sink.write(event);
  }
}

type Renderer = (event: LogEvent) => string;

// Glyphs tag each event visually in pretty mode without costing a color escape.
const GLYPHS: Record<LogLevel, string> = {
  debug: '·',
  info: '•',
  warn: '⚠',
  error: '✖',
};

// Pretty renderer drops ts/level from the inline string — the glyph already
// carries the level, and timestamps add noise to interactive CLIs.
const prettyRenderer: Renderer = (event) => {
  const { ts: _ts, level, msg, ...fields } = event;
  const fieldsStr = Object.keys(fields).length > 0
    ? ' ' + Object.entries(fields).map(([k, v]) => `${k}=${formatValue(v)}`).join(' ')
    : '';
  return `${GLYPHS[level]} ${msg}${fieldsStr}`;
};

const jsonRenderer: Renderer = (event) => JSON.stringify(event);

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Writes events to stderr. Stdout is intentionally left clean so commands
 * can pipe their deliverable output (job lists, JSON payloads) without
 * log noise contaminating the stream.
 */
export function createConsoleSink(format: 'pretty' | 'json' = 'pretty'): LogSink {
  const renderer = format === 'json' ? jsonRenderer : prettyRenderer;
  return {
    write(event) {
      process.stderr.write(renderer(event) + '\n');
    },
  };
}

/**
 * Appends one JSON event per line to a file. Creates the parent directory
 * on construction. Uses synchronous append so crash mid-command still flushes
 * the last event — we pay a small I/O cost for that guarantee.
 */
export function createFileSink(filePath: string): LogSink {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  return {
    write(event) {
      fs.appendFileSync(filePath, JSON.stringify(event) + '\n');
    },
  };
}

/**
 * Captures events in an in-memory array. For tests that want to assert on
 * what was logged.
 */
export interface MemorySink extends LogSink {
  readonly events: LogEvent[];
  clear(): void;
}
export function createMemorySink(): MemorySink {
  const events: LogEvent[] = [];
  return {
    events,
    write(event) { events.push(event); },
    clear() { events.length = 0; },
  };
}

/**
 * Constructs a logger. Precedence for level and format:
 *   explicit option → WOLF_LOG / WOLF_LOG_FORMAT env var → default.
 *
 * Default sink is a pretty-format console sink on stderr. Pass `sinks` to
 * compose multiple sinks (console + file) or to redirect output entirely.
 */
export function createLogger(opts: CreateLoggerOptions = {}): Logger {
  const level = opts.level ?? parseLevel(process.env.WOLF_LOG) ?? 'info';
  const sinks = opts.sinks ?? [createConsoleSink(parseFormat(process.env.WOLF_LOG_FORMAT))];
  return new LoggerImpl(level, sinks);
}

/**
 * A logger that drops every event. Useful for test AppContexts where log
 * output would be noise in the test runner.
 */
export function createSilentLogger(): Logger {
  return new LoggerImpl('error', []);
}

function parseLevel(s: string | undefined): LogLevel | undefined {
  if (s === 'debug' || s === 'info' || s === 'warn' || s === 'error') return s;
  return undefined;
}

function parseFormat(s: string | undefined): 'pretty' | 'json' {
  return s === 'json' ? 'json' : 'pretty';
}
