import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { jobDirName, companyDirName, jobDir, companyDir } from '../workspacePaths.js';

// These helpers compose the on-disk directory names that host every job's and
// every company's prose artifacts. Real filesystem paths depend on them, so a
// regression here can silently split a single entity across two directories or
// create invalid paths on disk.
describe('workspacePaths', () => {
  // A stable 36-char UUID whose first 8 hex chars (dashes stripped) are
  // "01234567" — used as the expected short id in several assertions below.
  const JOB_ID = '01234567-89ab-cdef-0123-456789abcdef';
  const COMPANY_ID = 'deadbeef-1234-5678-9abc-def012345678';

  describe('jobDirName()', () => {
    // Happy path: alphanumeric labels pass through; short id is 8 hex chars.
    it('composes <company>_<title>_<shortId> for plain inputs', () => {
      expect(jobDirName('Acme', 'Engineer', JOB_ID)).toBe('Acme_Engineer_01234567');
    });

    // Spaces, punctuation, and other unsafe chars must become underscores so
    // the result is a valid directory name on every filesystem wolf supports.
    it('replaces unsafe characters with underscores', () => {
      expect(jobDirName('A&B, Co.', 'C++ Dev', JOB_ID)).toBe('A_B_Co__C_Dev_01234567');
    });

    // Runs of unsafe chars must collapse to a single underscore — otherwise
    // "Foo   Bar" becomes "Foo___Bar", which is ugly and disk-name-noisy.
    it('collapses consecutive unsafe characters into one underscore', () => {
      expect(jobDirName('Foo   Bar', 'X', JOB_ID)).toBe('Foo_Bar_X_01234567');
    });

    // Hyphens are explicitly allowed in labels (the safe-char set includes
    // `-`), so they must survive into the final directory name.
    it('preserves hyphens in labels', () => {
      expect(jobDirName('Foo-Bar', 'Front-End', JOB_ID)).toBe('Foo-Bar_Front-End_01234567');
    });

    // Labels longer than 40 chars are truncated. Guards against runaway
    // company or title strings creating paths that hit OS length limits.
    it('truncates labels longer than 40 characters', () => {
      const longLabel = 'A'.repeat(60);
      const name = jobDirName(longLabel, 'X', JOB_ID);
      // 40 A's, underscore, X, underscore, 8-char short id.
      expect(name).toBe(`${'A'.repeat(40)}_X_01234567`);
    });

    // Unicode (CJK etc.) is not in the safe-char allowlist, so every code
    // point becomes an underscore and the run collapses to a single '_'.
    it('reduces all-unicode labels to a single underscore', () => {
      expect(jobDirName('字节跳动', '工程师', JOB_ID)).toBe('____01234567');
    });

    // A UUID without dashes must yield the exact same short id as the same
    // UUID with dashes — the shortening step is dash-insensitive.
    it('produces the same short id regardless of UUID dash formatting', () => {
      const dashed = jobDirName('Acme', 'Eng', JOB_ID);
      const undashed = jobDirName('Acme', 'Eng', JOB_ID.replace(/-/g, ''));
      expect(dashed).toBe(undashed);
    });

    // IDs shorter than 8 chars should not throw — slice silently returns the
    // whole string. This keeps the helper safe for test fixtures or
    // non-UUID synthetic ids.
    it('tolerates ids shorter than 8 characters', () => {
      expect(jobDirName('Acme', 'Eng', 'abc')).toBe('Acme_Eng_abc');
    });
  });

  describe('companyDirName()', () => {
    // Happy path mirrors jobDirName but without a title segment.
    it('composes <company>_<shortId> for plain inputs', () => {
      expect(companyDirName('Acme', COMPANY_ID)).toBe('Acme_deadbeef');
    });

    // Same sanitization rules as jobDirName — this verifies the helpers share
    // the same safeLabel implementation and don't drift.
    it('applies the same sanitization rules as jobDirName', () => {
      expect(companyDirName('A & B, Co.', COMPANY_ID)).toBe('A_B_Co__deadbeef');
    });
  });

  describe('jobDir()', () => {
    // The full path must always nest under `<workspaceDir>/data/jobs/` — the
    // "data/jobs" prefix is what ties the filesystem layout to the
    // architecture decision (DECISIONS.md 2026-04-18).
    it('joins the dir name under <workspaceDir>/data/jobs/', () => {
      const p = jobDir('/ws', 'Acme', 'Engineer', JOB_ID);
      expect(p).toBe(path.join('/ws', 'data', 'jobs', 'Acme_Engineer_01234567'));
    });

    // Relative workspace paths must work too — caller controls absoluteness.
    it('works with relative workspace paths', () => {
      const p = jobDir('./ws', 'Acme', 'Eng', JOB_ID);
      expect(p).toBe(path.join('./ws', 'data', 'jobs', 'Acme_Eng_01234567'));
    });
  });

  describe('companyDir()', () => {
    // Analogous to jobDir but for the companies/ subtree.
    it('joins the dir name under <workspaceDir>/data/companies/', () => {
      const p = companyDir('/ws', 'Acme', COMPANY_ID);
      expect(p).toBe(path.join('/ws', 'data', 'companies', 'Acme_deadbeef'));
    });
  });
});
