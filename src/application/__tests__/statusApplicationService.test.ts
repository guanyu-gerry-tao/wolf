import { afterEach, describe, it, expect, vi } from 'vitest';
import pino from 'pino';
import { sink } from 'pino-test';
import { StatusApplicationServiceImpl } from '../impl/statusApplicationServiceImpl.js';
import { createSilentLogger, setDefaultLogger } from '../../utils/logger.js';
import type { StatusCounter } from '../statusApplicationService.js';

// StatusApplicationService is the single point that every module's status
// contribution runs through. Tests here guard the registry pattern itself:
// parallel fan-out, failure tolerance, and event logging on counter failure.
describe('StatusApplicationServiceImpl', () => {
  // Restore the silent default between tests in this file. One of the tests
  // below installs a pino sink stream to capture a log event; without this
  // afterEach, a later test in the same file would inherit that sink.
  // Vitest isolates module state per FILE (isolate: true by default), so
  // no setup is needed in test files that never mutate setDefaultLogger.
  afterEach(() => setDefaultLogger(createSilentLogger()));

  // Helper: build a counter from a label and a value/function.
  function makeCounter(label: string, value: number | (() => Promise<number>)): StatusCounter {
    if (typeof value === 'function') return { label, count: value };
    return { label, count: vi.fn().mockResolvedValue(value) };
  }

  // Happy path: every counter resolves, the summary preserves registration order.
  it('returns one StatusCount per counter in registration order', async () => {
    const counters = [
      makeCounter('tracked', 12),
      makeCounter('tailored', 3),
      makeCounter('applied', 1),
    ];
    const svc = new StatusApplicationServiceImpl(counters);
    const summary = await svc.getSummary();
    expect(summary.counters).toEqual([
      { label: 'tracked', count: 12 },
      { label: 'tailored', count: 3 },
      { label: 'applied', count: 1 },
    ]);
  });

  // Counters must run in parallel — slow counter A should not serialize counter B.
  // We assert this by measuring that total time is close to max(durations), not sum.
  it('runs counters in parallel, not serially', async () => {
    const slow = () => new Promise<number>((r) => setTimeout(() => r(1), 50));
    const fast = () => new Promise<number>((r) => setTimeout(() => r(2), 50));
    const svc = new StatusApplicationServiceImpl(
      [makeCounter('slow', slow), makeCounter('fast', fast)],
    );
    const t0 = Date.now();
    await svc.getSummary();
    const elapsed = Date.now() - t0;
    // Parallel: ~50ms. Serial: ~100ms. Generous upper bound accounts for CI jitter.
    expect(elapsed).toBeLessThan(90);
  });

  // A single counter throwing must not abort the rest of the summary — the
  // dashboard should still render partial data with the failure annotated.
  it('returns count=0 and error message when a counter throws', async () => {
    const counters: StatusCounter[] = [
      makeCounter('ok', 5),
      { label: 'broken', count: vi.fn().mockRejectedValue(new Error('db down')) },
      makeCounter('also-ok', 7),
    ];
    const svc = new StatusApplicationServiceImpl(counters);
    const summary = await svc.getSummary();
    expect(summary.counters).toEqual([
      { label: 'ok', count: 5 },
      { label: 'broken', count: 0, error: 'db down' },
      { label: 'also-ok', count: 7 },
    ]);
  });

  // Counter failures must be logged so the operator can investigate post-hoc
  // by reading data/logs/wolf.log.jsonl.
  it('logs a warn event when a counter fails', async () => {
    // Install a pino instance whose output goes to a pino-test sink. The
    // `log` facade re-reads _default on every call, so the next log.warn
    // inside the service will hit THIS pino logger and land in the stream.
    // We collect emitted events via the stream's 'data' listener so the
    // assertions can live outside pino-test's deep-equality helper (which
    // would have to match every emitted field exactly, including `time`).
    const stream = sink();
    setDefaultLogger(pino({ level: 'debug' }, stream));

    const events: Record<string, unknown>[] = [];
    stream.on('data', (line) => events.push(line));

    const counters: StatusCounter[] = [
      { label: 'broken', count: vi.fn().mockRejectedValue(new Error('boom')) },
    ];
    const svc = new StatusApplicationServiceImpl(counters);
    await svc.getSummary();

    // Pino emits synchronously for a standard stream, so the event is
    // already in `events` by the time await resolves.
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.msg).toBe('status.counter.failed');
    expect(event.level).toBe(40); // pino numeric for `warn`
    expect(event.label).toBe('broken');
    expect(event.error).toBe('boom');
  });

  // Non-Error throws (string, undefined) must still produce a useful error
  // message rather than crashing the summary or logging [object Object].
  it('coerces non-Error throws to a string', async () => {
    const counters: StatusCounter[] = [
      { label: 'bad', count: vi.fn().mockRejectedValue('bare string') },
    ];
    const svc = new StatusApplicationServiceImpl(counters);
    const summary = await svc.getSummary();
    expect(summary.counters[0].error).toBe('bare string');
  });

  // Empty registry is a valid state (e.g. before any module has registered).
  // The summary should be empty but not throw.
  it('handles an empty counter registry', async () => {
    const svc = new StatusApplicationServiceImpl([]);
    const summary = await svc.getSummary();
    expect(summary.counters).toEqual([]);
  });
});
