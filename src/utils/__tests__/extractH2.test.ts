import { describe, it, expect } from 'vitest';
import { extractH2Content } from '../extractH2.js';

describe('extractH2Content()', () => {
  // Happy path: a single H2 with an answer body underneath.
  it('returns the body of a matching H2', () => {
    const md = '# Identity\n\n## Legal first name\nGuanyu\n\n## Legal last name\nTao\n';
    expect(extractH2Content(md, 'Legal first name')).toBe('Guanyu');
    expect(extractH2Content(md, 'Legal last name')).toBe('Tao');
  });

  // The body may span multiple lines until the next H1 / H2 boundary.
  it('captures multi-line body up to the next H2', () => {
    const md = '## Full address\n123 Main St\nApt 4\nSF, CA\n\n## Email\ng@example.com\n';
    expect(extractH2Content(md, 'Full address')).toBe('123 Main St\nApt 4\nSF, CA');
  });

  // Body spans up to the next H1 too — sections at end of category should not
  // bleed into the next category's body.
  it('stops at a following H1 boundary', () => {
    const md = '## Phone\n+1 555 0100\n\n# Contact\n## Email\ng@x';
    expect(extractH2Content(md, 'Phone')).toBe('+1 555 0100');
  });

  // Missing section returns empty string (not undefined / not throw).
  it('returns empty string when the H2 is absent', () => {
    const md = '# Identity\n\n## Legal first name\nGuanyu\n';
    expect(extractH2Content(md, 'Pronouns')).toBe('');
  });

  // Empty body (immediately followed by another H2) returns empty string.
  it('returns empty string for a blank body', () => {
    const md = '## Legal first name\n\n## Legal last name\nTao';
    expect(extractH2Content(md, 'Legal first name')).toBe('');
  });

  // First match wins when (against convention) the same H2 appears twice.
  it('returns the first match when duplicate H2 titles exist', () => {
    const md = '## Email\nfirst@example.com\n\n## Email\nsecond@example.com';
    expect(extractH2Content(md, 'Email')).toBe('first@example.com');
  });

  // Case-sensitive title match — wolf's templates are consistent so this is
  // the safer default; mismatches surface as missing-field errors during tailor.
  it('matches case-sensitively', () => {
    const md = '## Email\ng@x\n';
    expect(extractH2Content(md, 'email')).toBe('');
  });

  // Title trimming on both ends so a `##  Email   ` heading still matches `Email`.
  it('tolerates leading/trailing whitespace in the H2 line', () => {
    const md = '##   Email   \ng@x\n';
    expect(extractH2Content(md, 'Email')).toBe('g@x');
  });

  // H3 ('### ...') inside the body is part of the body, not a section break.
  it('treats H3 as body content, not a section break', () => {
    const md = '## Experience\n### Role\n*2024*\n- bullet\n## Skills\nTS';
    expect(extractH2Content(md, 'Experience')).toBe('### Role\n*2024*\n- bullet');
  });

  // Empty input is empty result.
  it('handles empty markdown', () => {
    expect(extractH2Content('', 'Anything')).toBe('');
  });
});
