import { describe, it, expect } from 'vitest';
import { stripComments } from '../stripComments.js';

describe('stripComments()', () => {
  // No alert blocks → unchanged.
  it('returns text unchanged when there are no alert blocks', () => {
    const input = '## Experience\n- Built something\n\n## Skills\nTypeScript';
    expect(stripComments(input)).toBe(input);
  });

  // A plain blockquote without an alert head is real markdown content
  // (the user quoting an interview question, an email, a paper, etc.).
  // It must survive — only `> [!XYZ]` blocks are stripped.
  it('preserves plain > blockquotes (no alert head)', () => {
    const input = 'The recruiter wrote:\n> Why are you interested in our product?\n\nI responded that ...';
    expect(stripComments(input)).toBe(input);
  });

  // GitHub Alert block: head + continuation lines all stripped.
  it('strips a > [!IMPORTANT] block (head + body)', () => {
    const input = '> [!IMPORTANT]\n> You must answer this.\n## Field\nvalue';
    expect(stripComments(input)).toBe('## Field\nvalue');
  });

  // The default tag for user notes in wolf templates is [!TIP]; verify it strips.
  it('strips a > [!TIP] block', () => {
    const input = '> [!TIP]\n> Defaults to United States; edit if abroad.\nUnited States';
    expect(stripComments(input)).toBe('United States');
  });

  // Any [!XYZ] tag works: TIP / IMPORTANT / NOTE / WARNING / CAUTION / custom.
  it('strips any > [!XYZ] alert block, regardless of tag', () => {
    const input = '> [!NOTE]\n> note body\nReal A\n> [!WARNING]\n> warn body\nReal B\n> [!CAUTION]\n> caution body\nReal C';
    expect(stripComments(input)).toBe('Real A\nReal B\nReal C');
  });

  // The alert block ends at the first non-blockquote line. A subsequent plain
  // `>` line (separated by content) is NOT part of any alert block — so it stays.
  it('ends the alert block at the first non-blockquote line; plain > after stays', () => {
    const input = '> [!TIP]\n> first body\n> second body\nactual content\n> separate quote';
    expect(stripComments(input)).toBe('actual content\n> separate quote');
  });

  // Adjacent alert blocks separated by a blank line are stripped independently.
  it('strips two adjacent alert blocks separated by a blank line', () => {
    const input = '> [!TIP]\n> first block\n\n> [!TIP]\n> second block\n\nreal content';
    expect(stripComments(input)).toBe('\n\nreal content');
  });

  // A line containing > mid-content (e.g. `if x > 5`) must not trigger anything.
  it('does not strip lines that contain > but do not start with >', () => {
    const input = 'if x > 5: do_thing()\nmore code';
    expect(stripComments(input)).toBe(input);
  });

  // Indented alert head still counts as an alert (rare but possible from copy-paste).
  it('strips an indented > [!IMPORTANT] block', () => {
    const input = '  > [!IMPORTANT]\n  > body line\n## Header';
    expect(stripComments(input)).toBe('## Header');
  });

  // A `>` continuation line after the alert head with mid-body `[!XYZ]` does
  // NOT start a new block — it's still continuation. The whole block stays gone.
  it('treats every > after the head as continuation, regardless of content', () => {
    const input = '> [!TIP]\n> body referencing [!IMPORTANT] inline\n> still continuation\nreal';
    expect(stripComments(input)).toBe('real');
  });

  // The legacy `//` marker is no longer special — those lines reach the AI.
  it('does NOT strip lines that start with // (legacy marker is inert now)', () => {
    const input = '// this is a JS-style code-sample comment\n## Header';
    expect(stripComments(input)).toBe(input);
  });

  // Empty string → empty string.
  it('handles empty string', () => {
    expect(stripComments('')).toBe('');
  });

  // Alert block at end-of-file (no trailing non-blockquote line) is still stripped.
  it('strips an alert block that runs to end-of-file', () => {
    const input = 'real content\n> [!TIP]\n> trailing tip body';
    expect(stripComments(input)).toBe('real content');
  });
});
