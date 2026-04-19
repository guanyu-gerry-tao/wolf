import { describe, it, expect, vi } from 'vitest';
import { StatusApplicationServiceImpl } from '../impl/statusApplicationServiceImpl.js';
import { createSilentLogger, createMemorySink } from '../../utils/logger.js';
import type { StatusCounter } from '../statusApplicationService.js';
import type { Logger } from '../../utils/logger.js';

// StatusApplicationService is the single point that every module's status
// contribution runs through. Tests here guard the registry pattern itself:
// parallel fan-out, failure tolerance, and event logging on counter failure.
describe('StatusApplicationServiceImpl', () => {
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
    const svc = new StatusApplicationServiceImpl(counters, createSilentLogger());
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
      createSilentLogger(),
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
    const svc = new StatusApplicationServiceImpl(counters, createSilentLogger());
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
    const sink = createMemorySink();
    const logger: Logger = {
      debug: vi.fn(), info: vi.fn(),
      warn: (msg, fields) => sink.write({ ts: '', level: 'warn', msg, ...(fields ?? {}) }),
      error: vi.fn(),
    };
    const counters: StatusCounter[] = [
      { label: 'broken', count: vi.fn().mockRejectedValue(new Error('boom')) },
    ];
    const svc = new StatusApplicationServiceImpl(counters, logger);
    await svc.getSummary();
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0].msg).toBe('Status counter failed');
    expect(sink.events[0].label).toBe('broken');
    expect(sink.events[0].error).toBe('boom');
  });

  // Non-Error throws (string, undefined) must still produce a useful error
  // message rather than crashing the summary or logging [object Object].
  it('coerces non-Error throws to a string', async () => {
    const counters: StatusCounter[] = [
      { label: 'bad', count: vi.fn().mockRejectedValue('bare string') },
    ];
    const svc = new StatusApplicationServiceImpl(counters, createSilentLogger());
    const summary = await svc.getSummary();
    expect(summary.counters[0].error).toBe('bare string');
  });

  // Empty registry is a valid state (e.g. before any module has registered).
  // The summary should be empty but not throw.
  it('handles an empty counter registry', async () => {
    const svc = new StatusApplicationServiceImpl([], createSilentLogger());
    const summary = await svc.getSummary();
    expect(summary.counters).toEqual([]);
  });
});
