import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createConsoleSink,
  createFileSink,
  createLogger,
  createMemorySink,
  createSilentLogger,
  type Logger,
} from '../logger.js';

// The logger is pure infrastructure — every assertion here guards a behavior
// that downstream services will rely on (level filtering, structured fields,
// sink fan-out, file persistence). Breakage here breaks observability for
// every long-running flow in wolf (tailor, hunt, score).
describe('logger', () => {
  describe('level filtering', () => {
    // Default level is info → debug events must be silently dropped.
    it('drops debug events at default level', () => {
      const sink = createMemorySink();
      const logger = createLogger({ sinks: [sink] });
      logger.debug('should not appear');
      expect(sink.events).toHaveLength(0);
    });

    // At debug level, every level must pass through.
    it('emits all levels when threshold is debug', () => {
      const sink = createMemorySink();
      const logger = createLogger({ level: 'debug', sinks: [sink] });
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(sink.events.map(ev => ev.level)).toEqual(['debug', 'info', 'warn', 'error']);
    });

    // At warn level, debug and info must be dropped but warn/error pass.
    it('only emits warn and error when threshold is warn', () => {
      const sink = createMemorySink();
      const logger = createLogger({ level: 'warn', sinks: [sink] });
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(sink.events.map(ev => ev.level)).toEqual(['warn', 'error']);
    });
  });

  describe('event shape', () => {
    // Every event must carry a structured shape: ts + level + msg + any
    // user-provided fields flattened onto the root object.
    it('produces events with ts, level, msg, and flattened fields', () => {
      const sink = createMemorySink();
      const logger = createLogger({ sinks: [sink] });
      logger.info('tailoring resume', { jobId: 'abc123', profileId: 'default' });
      expect(sink.events).toHaveLength(1);
      const ev = sink.events[0];
      expect(ev.level).toBe('info');
      expect(ev.msg).toBe('tailoring resume');
      expect(ev.jobId).toBe('abc123');
      expect(ev.profileId).toBe('default');
      // ts must be a valid ISO-8601 string so log aggregators can parse it.
      expect(ev.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    // A message without fields should still emit a valid event — the fields
    // argument is optional and most log calls omit it.
    it('handles events with no fields', () => {
      const sink = createMemorySink();
      const logger = createLogger({ sinks: [sink] });
      logger.info('no fields here');
      expect(sink.events[0].msg).toBe('no fields here');
    });
  });

  describe('sink fan-out', () => {
    // Every configured sink must receive every event that passes the level
    // filter. Fan-out is how we support console + file at the same time.
    it('writes the same event to every sink', () => {
      const a = createMemorySink();
      const b = createMemorySink();
      const logger = createLogger({ sinks: [a, b] });
      logger.info('ping');
      expect(a.events).toHaveLength(1);
      expect(b.events).toHaveLength(1);
      expect(a.events[0].msg).toBe(b.events[0].msg);
    });
  });

  describe('createConsoleSink', () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Hijack stderr so we can assert exactly what the sink wrote.
      stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });
    afterEach(() => {
      stderrSpy.mockRestore();
    });

    // Logger output belongs on stderr — stdout is reserved for command
    // deliverables so `wolf job ls | grep open` stays unpolluted.
    it('writes to stderr, not stdout', () => {
      const sink = createConsoleSink('json');
      sink.write({ ts: 'T', level: 'info', msg: 'hi' });
      expect(stderrSpy).toHaveBeenCalledTimes(1);
    });

    // Pretty mode: single-line human format with a level glyph and fields
    // rendered as key=value pairs.
    it('renders pretty format with glyph + message + fields', () => {
      const sink = createConsoleSink('pretty');
      sink.write({ ts: 'T', level: 'warn', msg: 'rate-limited', attempt: 2 });
      const written = String(stderrSpy.mock.calls[0][0]);
      expect(written).toContain('⚠ rate-limited');
      expect(written).toContain('attempt=2');
      expect(written.endsWith('\n')).toBe(true);
    });

    // JSON mode: one line of parseable JSON per event.
    it('renders json format as one JSON object per line', () => {
      const sink = createConsoleSink('json');
      sink.write({ ts: '2026-04-18T00:00:00.000Z', level: 'error', msg: 'boom', code: 1 });
      const written = String(stderrSpy.mock.calls[0][0]);
      expect(written.endsWith('\n')).toBe(true);
      const parsed = JSON.parse(written.trim());
      expect(parsed).toEqual({
        ts: '2026-04-18T00:00:00.000Z',
        level: 'error',
        msg: 'boom',
        code: 1,
      });
    });

    // Object-typed fields must be JSON-stringified in pretty mode, otherwise
    // they render as useless "[object Object]".
    it('stringifies nested object values in pretty mode', () => {
      const sink = createConsoleSink('pretty');
      sink.write({ ts: 'T', level: 'info', msg: 'nested', meta: { a: 1, b: 'x' } });
      const written = String(stderrSpy.mock.calls[0][0]);
      expect(written).toContain('meta={"a":1,"b":"x"}');
    });
  });

  describe('createFileSink', () => {
    let tmpDir: string;
    beforeEach(() => {
      // Real tmp dir so we can also verify auto-mkdir of nested parents.
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wolf-logger-'));
    });
    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // Each write must append one newline-delimited JSON object — the JSONL
    // shape that every log aggregator and every unix tool understands.
    it('appends one JSON event per line', () => {
      const filePath = path.join(tmpDir, 'wolf.log.jsonl');
      const sink = createFileSink(filePath);
      sink.write({ ts: 'T1', level: 'info', msg: 'first', n: 1 });
      sink.write({ ts: 'T2', level: 'warn', msg: 'second', n: 2 });
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual({ ts: 'T1', level: 'info', msg: 'first', n: 1 });
      expect(JSON.parse(lines[1])).toEqual({ ts: 'T2', level: 'warn', msg: 'second', n: 2 });
    });

    // If the parent directory doesn't exist yet (fresh workspace), the sink
    // must create it rather than erroring on the first write.
    it('creates the parent directory if missing', () => {
      const filePath = path.join(tmpDir, 'nested', 'dir', 'wolf.log.jsonl');
      const sink = createFileSink(filePath);
      sink.write({ ts: 'T', level: 'info', msg: 'hi' });
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('createLogger defaults', () => {
    const savedEnv = { ...process.env };
    afterEach(() => {
      // Restore any env vars we mutated so one test can't leak into another.
      process.env = { ...savedEnv };
    });

    // When WOLF_LOG is not set, the logger must default to info — otherwise
    // users would either see every debug line or nothing at all.
    it('defaults to info level when WOLF_LOG is unset', () => {
      delete process.env.WOLF_LOG;
      const sink = createMemorySink();
      const logger = createLogger({ sinks: [sink] });
      logger.debug('drop me');
      logger.info('keep me');
      expect(sink.events).toHaveLength(1);
      expect(sink.events[0].msg).toBe('keep me');
    });

    // WOLF_LOG=debug must lower the threshold without requiring a code change.
    it('picks up WOLF_LOG=debug from the environment', () => {
      process.env.WOLF_LOG = 'debug';
      const sink = createMemorySink();
      const logger = createLogger({ sinks: [sink] });
      logger.debug('now visible');
      expect(sink.events).toHaveLength(1);
    });

    // Unknown WOLF_LOG values must fall back to info rather than crash — the
    // env var is user-facing and a typo shouldn't break the CLI.
    it('falls back to info when WOLF_LOG is an unknown value', () => {
      process.env.WOLF_LOG = 'trace';
      const sink = createMemorySink();
      const logger = createLogger({ sinks: [sink] });
      logger.debug('still dropped');
      logger.info('kept');
      expect(sink.events.map(e => e.msg)).toEqual(['kept']);
    });

    // Explicit option must override the env var so callers (AppContext,
    // tests) can fully control the logger regardless of the environment.
    it('explicit level option overrides WOLF_LOG', () => {
      process.env.WOLF_LOG = 'error';
      const sink = createMemorySink();
      const logger = createLogger({ level: 'info', sinks: [sink] });
      logger.info('kept');
      expect(sink.events).toHaveLength(1);
    });
  });

  describe('createSilentLogger', () => {
    // Must never emit anything — useful for test AppContexts that don't want
    // log noise in the test runner output.
    it('discards every event', () => {
      const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      try {
        const logger: Logger = createSilentLogger();
        logger.debug('x');
        logger.info('x');
        logger.warn('x');
        logger.error('x');
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });
  });
});
