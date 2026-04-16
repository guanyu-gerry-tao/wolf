import { describe, it, expect } from 'vitest';
import { getByPath, setByPath, coerceToShape } from '../dotPath.js';

describe('getByPath', () => {
  // Top-level access: the common "wolf config get defaultProfileId" case.
  it('reads a top-level scalar', () => {
    expect(getByPath({ name: 'Jane' }, 'name')).toBe('Jane');
  });

  // Nested access: most fields live one level deep (e.g. tailor.model).
  it('reads a nested value', () => {
    expect(getByPath({ tailor: { model: 'anthropic/x' } }, 'tailor.model')).toBe('anthropic/x');
  });

  // Array values are returned as-is; splitting into elements is the caller's job.
  it('returns arrays intact', () => {
    expect(getByPath({ roles: ['SWE', 'Eng'] }, 'roles')).toEqual(['SWE', 'Eng']);
  });

  // Missing key at leaf or intermediate: undefined instead of throwing,
  // so callers can distinguish "not set" from "set to undefined".
  it('returns undefined for missing keys', () => {
    expect(getByPath({ a: 1 }, 'b')).toBeUndefined();
    expect(getByPath({ a: { b: 1 } }, 'a.c')).toBeUndefined();
    expect(getByPath({ a: null }, 'a.b')).toBeUndefined();
  });

  // Null at any segment must not crash; walker stops and returns undefined.
  it('tolerates null mid-path without throwing', () => {
    expect(getByPath({ a: { b: null } }, 'a.b.c')).toBeUndefined();
  });
});

describe('setByPath', () => {
  // Immutability: callers rely on this to avoid accidentally mutating loaded configs.
  it('does not mutate the input', () => {
    const input = { a: { b: 1 } };
    setByPath(input, 'a.b', 99);
    expect(input.a.b).toBe(1);
  });

  // Happy path: update a scalar field at a nested path.
  it('updates a nested value', () => {
    const result = setByPath({ a: { b: 1 } }, 'a.b', 99);
    expect(result).toEqual({ a: { b: 99 } });
  });

  // Sibling fields at both the leaf's parent and its grandparent must be preserved.
  it('preserves sibling fields', () => {
    const result = setByPath(
      { a: { b: 1, c: 2 }, d: 3 },
      'a.b',
      99,
    );
    expect(result).toEqual({ a: { b: 99, c: 2 }, d: 3 });
  });

  // Creates intermediate objects so CLI users can add new nested keys without
  // pre-populating parent objects.
  it('creates intermediate objects when missing', () => {
    const result = setByPath({} as Record<string, unknown>, 'a.b.c', 42);
    expect(result).toEqual({ a: { b: { c: 42 } } });
  });
});

describe('coerceToShape', () => {
  // Numbers: most common non-string config case (hunt.minScore, maxEmailsPerDay).
  it('parses numbers when the target is a number', () => {
    expect(coerceToShape('0.7', 0.5)).toBe(0.7);
    expect(coerceToShape('42', 10)).toBe(42);
  });

  it('throws when a numeric target receives non-numeric input', () => {
    expect(() => coerceToShape('abc', 0)).toThrow(/Expected number/);
  });

  // Booleans: only "true"/"false" literals are accepted; anything else is a user error.
  it('parses booleans when the target is a boolean', () => {
    expect(coerceToShape('true', false)).toBe(true);
    expect(coerceToShape('false', true)).toBe(false);
  });

  it('throws when a boolean target receives anything else', () => {
    expect(() => coerceToShape('yes', false)).toThrow(/Expected boolean/);
  });

  // Arrays use comma-separated because JSON-array syntax is awkward at the shell prompt.
  // Empty entries are dropped so trailing commas and double commas don't create "" items.
  it('splits comma-separated input into an array', () => {
    expect(coerceToShape('SWE, Eng, Data', ['x'])).toEqual(['SWE', 'Eng', 'Data']);
    expect(coerceToShape('a,,b,', ['x'])).toEqual(['a', 'b']);
  });

  // Strings: the default catch-all. Phone numbers, URLs, model refs all land here.
  it('passes strings through untouched', () => {
    expect(coerceToShape('Jane Doe', 'Alex')).toBe('Jane Doe');
    expect(coerceToShape('anthropic/claude-sonnet-4-6', 'x/y')).toBe('anthropic/claude-sonnet-4-6');
  });

  // No current value: can't infer type, so fall back to string and let Zod
  // produce a clear error downstream if the shape is wrong.
  it('falls back to string when the current value is absent', () => {
    expect(coerceToShape('whatever', undefined)).toBe('whatever');
  });
});
