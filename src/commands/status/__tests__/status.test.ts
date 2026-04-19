import { describe, it, expect } from 'vitest';
import { formatStatus } from '../index.js';
import type { StatusSummary } from '../../../application/statusApplicationService.js';

// The formatter is the contract between the StatusApplicationService and
// the terminal. Tests here guard the visual shape users see — label
// alignment, error annotation, empty-state behavior — so regressions in
// the dashboard don't slip past CLI-layer integration.
describe('formatStatus()', () => {
  // Happy path: counters render as aligned `label  count` lines, with the
  // label column padded to the widest label so numbers line up vertically.
  it('renders counters as aligned label/count lines', () => {
    const summary: StatusSummary = {
      counters: [
        { label: 'tracked', count: 12 },
        { label: 'tailored', count: 3 },
        { label: 'applied', count: 1 },
      ],
    };
    const out = formatStatus(summary);
    // Longest label is "tailored" (8 chars) — every label padded to 8.
    expect(out).toBe('tracked   12\ntailored  3\napplied   1');
  });

  // A single failed counter must annotate its line inline and still render
  // the rest of the dashboard — this is what protects the operator from
  // losing all visibility when one count query breaks.
  it('annotates failed counters inline without dropping other lines', () => {
    const summary: StatusSummary = {
      counters: [
        { label: 'ok', count: 5 },
        { label: 'broken', count: 0, error: 'db down' },
        { label: 'also-ok', count: 7 },
      ],
    };
    const out = formatStatus(summary);
    const lines = out.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('broken');
    expect(lines[1]).toContain('[error: db down]');
  });

  // Empty registry is a valid intermediate state (no module has registered
  // yet). The formatter must return an empty string rather than crashing on
  // Math.max(...[]), which would otherwise return -Infinity.
  it('returns empty string for an empty counter list', () => {
    expect(formatStatus({ counters: [] })).toBe('');
  });

  // Single-counter case — ensure padEnd math still works with one label.
  it('handles a single-counter summary', () => {
    const out = formatStatus({ counters: [{ label: 'only', count: 9 }] });
    expect(out).toBe('only  9');
  });
});
