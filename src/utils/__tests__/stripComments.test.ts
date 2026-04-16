import { describe, it, expect } from 'vitest';
import { stripComments } from '../stripComments.js';

describe('stripComments()', () => {
  // Normal content with no comments should pass through unchanged.
  it('returns text unchanged when there are no comment lines', () => {
    const input = '## Experience\n- Built something\n\n## Skills\nTypeScript';
    expect(stripComments(input)).toBe(input);
  });

  // Lines starting with // should be removed entirely.
  it('removes lines that start with //', () => {
    const input = '// user note\n## Experience\n// another note\n- Built something';
    expect(stripComments(input)).toBe('## Experience\n- Built something');
  });

  // Leading whitespace before // should still be treated as a comment line.
  it('removes indented comment lines', () => {
    const input = '  // indented note\n## Skills\nTypeScript';
    expect(stripComments(input)).toBe('## Skills\nTypeScript');
  });

  // A URL like https://github.com must not be treated as a comment.
  it('does not strip lines that contain // but do not start with //', () => {
    const input = 'GitHub: https://github.com/user\n// actual comment';
    expect(stripComments(input)).toBe('GitHub: https://github.com/user');
  });

  // Empty string should return empty string without error.
  it('handles empty string', () => {
    expect(stripComments('')).toBe('');
  });
});
