import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import pino from 'pino';
import { sink } from 'pino-test';
import {
  createDefaultLogger,
  createSilentLogger,
  getLogger,
  log,
  setDefaultLogger,
} from '../logger.js';

// The logger wraps pino with an ergonomic facade. Tests here confirm
// the critical contract: facade call -> pino emission -> capture stream.
// Pino's own internals aren't re-tested; we trust the library.
describe('logger facade', () => {
  // Restore silence between tests so one test's capture stream doesn't
  // leak into another test's expectations.
  afterEach(() => setDefaultLogger(createSilentLogger()));

  // Helper: install a pino-test sink as the default logger and collect
  // every emitted line into a local array.
  function installCapture(level: 'debug' | 'info' | 'warn' | 'error' = 'debug') {
    const stream = sink();
    setDefaultLogger(pino({ level }, stream));
    const events: Record<string, unknown>[] = [];
    stream.on('data', (line) => events.push(line));
    return events;
  }

  // The facade must route method calls to the currently-installed pino
  // instance — not a reference captured at import time.
  it('emits the message through the currently-installed pino instance', () => {
    const events = installCapture();
    log.info('test.event');
    expect(events).toHaveLength(1);
    expect(events[0].msg).toBe('test.event');
    expect(events[0].level).toBe(30); // pino numeric for info
  });

  // Fields argument must be merged onto the emitted event.
  it('attaches structured fields when provided', () => {
    const events = installCapture();
    log.warn('test.warn', { jobId: 'abc', attempt: 2 });
    expect(events[0].msg).toBe('test.warn');
    expect(events[0].level).toBe(40); // warn
    expect(events[0].jobId).toBe('abc');
    expect(events[0].attempt).toBe(2);
  });

  // Each level must round-trip to pino's corresponding numeric level.
  // Guards against a typo in the facade that routes warn to info, etc.
  it('routes each facade level to the matching pino level', () => {
    const events = installCapture('debug');
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    // Pino numerics: trace=10, debug=20, info=30, warn=40, error=50, fatal=60.
    expect(events.map((e) => e.level)).toEqual([20, 30, 40, 50]);
  });

  // getLogger must return the instance last installed, so tests that need
  // the raw pino instance (for constructing child loggers, for example)
  // can reach it.
  it('getLogger returns the current default', () => {
    const logger = pino({ level: 'silent' });
    setDefaultLogger(logger);
    expect(getLogger()).toBe(logger);
  });
});

// Silent logger is the Null Object of the logging world — every level
// discards its input. Useful as the module's default and as a test-safe
// fallback when a real logger isn't appropriate.
describe('createSilentLogger', () => {
  it('returns a pino logger with level set to silent', () => {
    const logger = createSilentLogger();
    // pino's `silent` level string maps to the numeric value that disables
    // every emission. Calling .info(...) is a no-op.
    expect(logger.level).toBe('silent');
  });
});

// createDefaultLogger is the production-path builder. In tests
// (NODE_ENV=test), it must still produce a silent logger so calling it
// in a test context can never leak output to the real terminal or disk.
describe('createDefaultLogger', () => {
  it('returns a silent logger when NODE_ENV=test', () => {
    // Vitest sets NODE_ENV=test automatically, so this covers the test-env path.
    const logger = createDefaultLogger();
    expect(logger.level).toBe('silent');
  });

  it('still returns a silent logger even when filePath is supplied', () => {
    // Belt-and-suspenders: even if a test accidentally passes filePath,
    // the NODE_ENV=test check short-circuits before any file is opened.
    const logger = createDefaultLogger({ filePath: '/tmp/should-never-be-created' });
    expect(logger.level).toBe('silent');
  });

  // Prove the production path actually writes to disk. Without this test we
  // rely on "looks right in code review" for the file-sink behavior. By
  // temporarily overriding NODE_ENV we exercise the real branch against a
  // temp directory that cleans itself up.
  //
  // Pino's file transport runs in a worker thread for performance, so the
  // file write is asynchronous. We poll for the file to appear and contain
  // our event (up to 2 seconds), which is more robust than `logger.flush`
  // against the transport boot timing.
  it('writes JSONL to the given file path when NODE_ENV is not test', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wolf-logger-prod-'));
    const filePath = path.join(tmpDir, 'wolf.log.jsonl');

    // NOTE: this test also triggers pino's pretty console transport, which
    // writes one line to the actual stderr. We can't stub that — pino
    // transports run in an isolated worker_thread with its own stdio
    // handles, so main-thread stubs don't reach it. Accept the single line
    // of output as secondary evidence that the console transport works.

    try {
      // Pretend we're NOT in a test so createDefaultLogger takes the
      // production branch and actually opens the file for append.
      process.env.NODE_ENV = 'production';

      const logger = createDefaultLogger({ filePath });
      logger.info({ sample: 'field' }, 'prod.write.test');

      // Poll for the file to contain our event. Pino's transport worker
      // usually delivers within 50–200 ms; 2 s is a generous ceiling.
      const parsed = await pollForFirstLogEntry(filePath, 2000);

      expect(parsed.msg).toBe('prod.write.test');
      expect(parsed.level).toBe(30); // info
      expect(parsed.sample).toBe('field');
    } finally {
      // Always restore NODE_ENV and delete the temp workspace so the test
      // is isolated from the rest of the suite.
      process.env.NODE_ENV = originalNodeEnv;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// Polls a log file until it contains at least one complete JSONL line, then
// returns the parsed first line. Throws if the deadline passes first — the
// caller's expect() assertions then explain the mystery failure.
async function pollForFirstLogEntry(filePath: string, timeoutMs: number): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const contents = fs.readFileSync(filePath, 'utf-8');
      const firstLine = contents.split('\n').find((line) => line.trim().length > 0);
      if (firstLine !== undefined) {
        return JSON.parse(firstLine);
      }
    } catch {
      // File may not exist yet; loop and retry.
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`pollForFirstLogEntry: no log line appeared at ${filePath} within ${timeoutMs}ms`);
}
