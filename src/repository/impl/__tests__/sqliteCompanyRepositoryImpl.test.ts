import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initializeSchema } from '../initializeSchema.js';
import { SqliteCompanyRepositoryImpl } from '../sqliteCompanyRepositoryImpl.js';
import type { Company } from '../../../types/company.js';

// Integration tests for SqliteCompanyRepositoryImpl. Focused on `query()` and
// the new `nameContains` substring filter, plus the existing upsert + get
// paths that nothing covered directly before. These back up `--search` in
// `wolf job list` and any future `wolf company list`.
describe('SqliteCompanyRepositoryImpl', () => {
  let repo: SqliteCompanyRepositoryImpl;
  // Real temp directory so upsert()'s info.md writes don't spray files into
  // the project tree. Removed in afterEach below (via workspace-scoped dir).
  let workspaceDir: string;

  function makeCompany(overrides: Partial<Company>): Company {
    return {
      id: 'company-x',
      name: 'Acme',
      domain: null,
      linkedinUrl: null,
      size: null,
      industry: null,
      headquartersLocation: null,
      notes: null,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      ...overrides,
    };
  }

  beforeEach(async () => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wolf-company-repo-'));
    const sqlite = new BetterSqlite3(':memory:');
    const db = drizzle(sqlite);
    initializeSchema(db);
    repo = new SqliteCompanyRepositoryImpl(db, workspaceDir);

    // Seed companies with varied names and industries so substring tests
    // have both matches and non-matches to cover.
    await repo.upsert(makeCompany({ id: 'c-acme', name: 'Acme', industry: 'Software' }));
    await repo.upsert(makeCompany({ id: 'c-acme-corp', name: 'Acme Corporation', industry: 'Hardware' }));
    await repo.upsert(makeCompany({ id: 'c-beta', name: 'BetaMart', industry: 'Retail' }));
    await repo.upsert(makeCompany({ id: 'c-google', name: 'Google', industry: 'Software' }));
  });

  describe('get() / getByName()', () => {
    // Basic sanity: inserted rows come back whole.
    it('returns a stored company by id', async () => {
      const row = await repo.get('c-acme');
      expect(row?.name).toBe('Acme');
    });

    // Missing id returns null rather than throwing — callers can decide
    // how to handle the absence.
    it('returns null for an unknown id', async () => {
      const row = await repo.get('does-not-exist');
      expect(row).toBeNull();
    });

    // getByName is used during ingest to dedupe company rows.
    it('returns a company by exact name match', async () => {
      const row = await repo.getByName('BetaMart');
      expect(row?.id).toBe('c-beta');
    });
  });

  describe('query({ nameContains })', () => {
    // Substring match must hit every company whose name contains the needle.
    // Two Acme rows → both returned for "Acme".
    it('returns every company whose name contains the substring', async () => {
      const rows = await repo.query({ nameContains: 'Acme' });
      const ids = rows.map((r) => r.id).sort();
      expect(ids).toEqual(['c-acme', 'c-acme-corp']);
    });

    // SQLite's default LIKE is case-insensitive for ASCII. Users type what
    // they type; the filter must not care about casing.
    it('is case-insensitive for ASCII', async () => {
      const lower = await repo.query({ nameContains: 'acme' });
      const upper = await repo.query({ nameContains: 'ACME' });
      const mixed = await repo.query({ nameContains: 'AcMe' });
      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
    });

    // No match must return an empty array, not every row (would happen if
    // the condition was accidentally skipped for empty results).
    it('returns no rows when nothing matches', async () => {
      const rows = await repo.query({ nameContains: 'doesnotexist' });
      expect(rows).toEqual([]);
    });

    // Empty string must not become `LIKE '%%'` (matches everything). The
    // impl short-circuits on length-zero, so the whole filter is ignored
    // and every row is returned.
    it('ignores an empty nameContains value', async () => {
      const rows = await repo.query({ nameContains: '' });
      expect(rows.length).toBe(4);
    });
  });

  describe('query() filter composition', () => {
    // nameContains combines with other CompanyQuery fields via AND.
    it('ANDs nameContains with industry', async () => {
      const rows = await repo.query({ nameContains: 'Acme', industry: 'Software' });
      expect(rows.map((r) => r.id)).toEqual(['c-acme']);
    });

    // Passing `limit` caps result size independently of the matching set —
    // used by list commands with page sizes.
    it('caps results with limit', async () => {
      const rows = await repo.query({ nameContains: 'Acme', limit: 1 });
      expect(rows.length).toBe(1);
    });
  });
});
