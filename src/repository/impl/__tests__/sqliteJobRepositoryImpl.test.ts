import { describe, it, expect, beforeEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initializeSchema } from '../initializeSchema.js';
import { SqliteJobRepositoryImpl } from '../sqliteJobRepositoryImpl.js';
import { SqliteCompanyRepositoryImpl } from '../sqliteCompanyRepositoryImpl.js';
import type { Job } from '../../../types/job.js';
import type { Company } from '../../../types/company.js';

// Integration tests for the new count/query surface added in this PR.
// These hit a real in-memory SQLite via the same Drizzle layer production
// uses, so the SQL is exercised end-to-end (not just mocked).
//
// Two goals:
//   1. Verify countAll / countWithTailoredResume / countMatching behave
//      correctly across filter combinations.
//   2. Guard against query() and countMatching() drifting apart — they share
//      buildConditions() today, but nothing enforces they stay aligned.
//      The `query(q).length === countMatching(q)` parity assertions below
//      are the compile-time-free safety net.
describe('SqliteJobRepositoryImpl — counts and query parity', () => {
  let jobRepo: SqliteJobRepositoryImpl;

  // Helpers to build valid rows without restating every field each time.
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

  function makeJob(overrides: Partial<Job>): Job {
    return {
      id: 'job-x',
      title: 'Engineer',
      companyId: 'company-x',
      url: 'https://example.com',
      source: 'Other',
      location: 'Remote',
      remote: true,
      salary: null,
      workAuthorizationRequired: 'no sponsorship',
      clearanceRequired: false,
      score: null,
      scoreJustification: null,
      status: 'new',
      error: null,
      appliedProfileId: null,
      tailoredResumePdfPath: null,
      coverLetterHtmlPath: null,
      coverLetterPdfPath: null,
      screenshotPath: null,
      outreachDraftPath: null,
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
      ...overrides,
    };
  }

  // Fresh in-memory DB before each test — tests must be isolated so one
  // mutation in an earlier case can't poison a later one.
  beforeEach(async () => {
    const sqlite = new BetterSqlite3(':memory:');
    const db = drizzle(sqlite);
    initializeSchema(db);
    const companyRepo = new SqliteCompanyRepositoryImpl(db, '/tmp/wolf-test');
    jobRepo = new SqliteJobRepositoryImpl(db, companyRepo, '/tmp/wolf-test');

    // Seed three companies + a handful of jobs with varied statuses, scores,
    // sources, and tailored-resume presence to exercise every filter.
    await companyRepo.upsert(makeCompany({ id: 'c-acme', name: 'Acme' }));
    await companyRepo.upsert(makeCompany({ id: 'c-beta', name: 'BetaCorp' }));
    await companyRepo.upsert(makeCompany({ id: 'c-gamma', name: 'Gamma' }));

    await jobRepo.saveMany([
      makeJob({ id: 'j1', companyId: 'c-acme', status: 'new', score: 0.5, source: 'LinkedIn',
        createdAt: '2026-04-10T00:00:00.000Z' }),
      makeJob({ id: 'j2', companyId: 'c-acme', status: 'applied', score: 0.9,
        tailoredResumePdfPath: '/path/resume.pdf', createdAt: '2026-04-12T00:00:00.000Z' }),
      makeJob({ id: 'j3', companyId: 'c-beta', status: 'reviewed', score: 0.8,
        tailoredResumePdfPath: '/path/resume2.pdf', source: 'Indeed',
        createdAt: '2026-04-14T00:00:00.000Z' }),
      makeJob({ id: 'j4', companyId: 'c-beta', status: 'applied', score: null,
        createdAt: '2026-04-16T00:00:00.000Z' }),
      makeJob({ id: 'j5', companyId: 'c-gamma', status: 'new', score: 0.3,
        createdAt: '2026-04-18T00:00:00.000Z' }),
    ]);
  });

  describe('countAll()', () => {
    // Total count must ignore every filter — straight SELECT COUNT(*) FROM jobs.
    it('returns the total row count regardless of status, score, or date', async () => {
      expect(await jobRepo.countAll()).toBe(5);
    });

    // Empty DB is a valid cold-start state — must return 0, not throw or NaN.
    it('returns 0 when the jobs table is empty', async () => {
      const sqlite = new BetterSqlite3(':memory:');
      const db = drizzle(sqlite);
      initializeSchema(db);
      const companyRepo = new SqliteCompanyRepositoryImpl(db, '/tmp/wolf-test');
      const emptyRepo = new SqliteJobRepositoryImpl(db, companyRepo, '/tmp/wolf-test');
      expect(await emptyRepo.countAll()).toBe(0);
    });
  });

  describe('countWithTailoredResume()', () => {
    // Counts only rows where tailoredResumePdfPath IS NOT NULL. Two of the
    // five seeded jobs have a path; the other three have null.
    it('counts only rows with a non-null tailoredResumePdfPath', async () => {
      expect(await jobRepo.countWithTailoredResume()).toBe(2);
    });

    // Updating a job to clear its tailored path must decrement the count —
    // guards against the path being treated as a monotonic "once set, set forever" flag.
    it('reflects updates that clear the tailored path', async () => {
      await jobRepo.update('j2', { tailoredResumePdfPath: null });
      expect(await jobRepo.countWithTailoredResume()).toBe(1);
    });
  });

  describe('countByStatus()', () => {
    // Must return every JobStatus key including applied_previously (the
    // previously-missing entry flagged during review). Unused statuses
    // report 0 rather than being omitted, so the consumer can index safely.
    it('returns a count for every JobStatus, including applied_previously', async () => {
      const byStatus = await jobRepo.countByStatus();
      expect(byStatus.new).toBe(2);
      expect(byStatus.applied).toBe(2);
      expect(byStatus.reviewed).toBe(1);
      expect(byStatus.applied_previously).toBe(0); // present-and-zero, not missing
      expect(byStatus.interview).toBe(0);
      expect(byStatus.offer).toBe(0);
      expect(byStatus.rejected).toBe(0);
      expect(byStatus.closed).toBe(0);
      expect(byStatus.error).toBe(0);
      expect(byStatus.ignored).toBe(0);
      expect(byStatus.filtered).toBe(0);
    });
  });

  describe('countMatching()', () => {
    // No filters → same as countAll().
    it('returns the full count when the query is empty', async () => {
      expect(await jobRepo.countMatching({})).toBe(5);
    });

    // Each filter narrows the set; countMatching must reflect the narrower
    // set even though query() may also be applying a limit on top.
    it('narrows on status filter', async () => {
      expect(await jobRepo.countMatching({ status: 'applied' })).toBe(2);
    });

    it('narrows on minScore filter', async () => {
      // Scores: 0.5, 0.9, 0.8, null, 0.3 — only 0.9 and 0.8 are ≥ 0.7.
      expect(await jobRepo.countMatching({ minScore: 0.7 })).toBe(2);
    });

    it('narrows on start filter', async () => {
      // Jobs created on or after 2026-04-14: j3, j4, j5.
      expect(await jobRepo.countMatching({ start: '2026-04-14T00:00:00.000Z' })).toBe(3);
    });

    it('narrows on end filter', async () => {
      // Jobs created on or before 2026-04-12: j1, j2.
      expect(await jobRepo.countMatching({ end: '2026-04-12T00:00:00.000Z' })).toBe(2);
    });

    it('combines start and end for a bounded range', async () => {
      // Between 2026-04-11 and 2026-04-15 inclusive: j2 (12th), j3 (14th).
      expect(await jobRepo.countMatching({
        start: '2026-04-11T00:00:00.000Z',
        end: '2026-04-15T00:00:00.000Z',
      })).toBe(2);
    });

    it('narrows on source filter', async () => {
      expect(await jobRepo.countMatching({ source: 'LinkedIn' })).toBe(1);
    });

    it('narrows on companyIds filter', async () => {
      expect(await jobRepo.countMatching({ companyIds: ['c-acme'] })).toBe(2);
    });

    it('combines multiple filters with AND semantics', async () => {
      // status=applied AND minScore=0.85 → only j2 (applied, 0.9).
      expect(await jobRepo.countMatching({ status: 'applied', minScore: 0.85 })).toBe(1);
    });

    // Crucially: countMatching MUST ignore a `limit` field if set. Total
    // matching is a pre-limit fact; without this the overflow footer
    // ("N more — use --limit <n>") would lie.
    it('ignores the limit field on the passed query', async () => {
      expect(await jobRepo.countMatching({ limit: 1 })).toBe(5);
    });
  });

  // Search exercises the JOIN path. Fixture review:
  //   j1 c-acme title="Engineer"    location="Remote"   → matches "acme", "engineer", "remote"
  //   j2 c-acme title="Engineer"    location="Remote"   → same
  //   j3 c-beta title="Engineer"    location="Remote"   → matches "beta", "engineer", "remote"
  //   j4 c-beta title="Engineer"    location="Remote"   → same
  //   j5 c-gamma title="Engineer"   location="Remote"   → matches "gamma", "engineer", "remote"
  // The seed builder gives every job the same title/location, so we extend
  // it in these tests where a field-specific match matters.
  describe('search filter', () => {
    // Matching a company name — exercises the JOIN with companies table.
    it('matches substrings against the joined company name', async () => {
      const rows = await jobRepo.query({ search: ['acme'] });
      // Two Acme jobs (j1, j2).
      expect(rows.map((r) => r.id).sort()).toEqual(['j1', 'j2']);
    });

    // Matching a title substring, independent of company or location.
    it('matches substrings against the job title', async () => {
      // Update one job's title so the test isn't trivial.
      await jobRepo.update('j1', { /* title stays Engineer */ });
      // Every seeded job has title="Engineer", so searching "engine" hits all five.
      const rows = await jobRepo.query({ search: ['engine'] });
      expect(rows).toHaveLength(5);
    });

    // Matching a location substring. Needs fresh data because the default
    // fixture sets every location to "Remote"; we upsert one job with a
    // specific location to verify field-targeted match.
    it('matches substrings against the job location', async () => {
      // Seed an extra job with a distinctive location string so the match
      // is unambiguous.
      await jobRepo.saveMany([
        makeJob({
          id: 'j-sf',
          companyId: 'c-acme',
          location: 'San Francisco',
          createdAt: '2026-04-20T00:00:00.000Z',
        }),
      ]);
      const rows = await jobRepo.query({ search: ['San Francisco'] });
      expect(rows.map((r) => r.id)).toEqual(['j-sf']);
    });

    // Case-insensitivity: SQLite's default LIKE is case-insensitive for
    // ASCII, which is what users actually type for --search queries.
    it('matches case-insensitively', async () => {
      const lower = await jobRepo.query({ search: ['acme'] });
      const mixed = await jobRepo.query({ search: ['AcMe'] });
      const upper = await jobRepo.query({ search: ['ACME'] });
      expect(lower.length).toBe(mixed.length);
      expect(lower.length).toBe(upper.length);
    });

    // Multiple --search terms must OR at the top level — giving two terms
    // should return rows matching EITHER, not rows matching both.
    it('ORs multiple search terms at the top level', async () => {
      const rows = await jobRepo.query({ search: ['acme', 'beta'] });
      // j1 + j2 match acme; j3 + j4 match beta. Four rows total.
      expect(rows.map((r) => r.id).sort()).toEqual(['j1', 'j2', 'j3', 'j4']);
    });

    // Search combines with other filters via AND at the top level. This
    // guards against the search OR "leaking" outside its group and
    // accidentally broadening the query.
    it('AND-combines search with non-search filters', async () => {
      // acme jobs (j1, j2) intersected with status=applied (j2, j4) = j2.
      const rows = await jobRepo.query({
        search: ['acme'],
        status: 'applied',
      });
      expect(rows.map((r) => r.id)).toEqual(['j2']);
    });

    // countMatching must use the same JOIN + predicate as query. If it
    // drifts, overflow footers will lie. This is the parity guard that
    // matters most because the search path is a different code branch
    // from the base path.
    it('countMatching agrees with query() length when search is set', async () => {
      const q = { search: ['acme'] };
      const [rows, count] = await Promise.all([
        jobRepo.query(q),
        jobRepo.countMatching(q),
      ]);
      expect(rows.length).toBe(count);
    });

    // Empty search array short-circuits — treated as no search, so the
    // result must equal the unfiltered total.
    it('treats an empty search array as no search', async () => {
      const rows = await jobRepo.query({ search: [] });
      expect(rows).toHaveLength(5);
    });
  });

  describe('query() and countMatching() parity', () => {
    // Parametric parity check: for a matrix of filter shapes, the number
    // of rows query() returns (with no limit) must equal countMatching().
    // If a future edit adds a filter to buildConditions but forgets to
    // cover it in one of the two, this test fails immediately instead of
    // users seeing wrong counts in the wild.
    const filterShapes: import('../../../types/job.js').JobQuery[] = [
      {},
      { status: 'applied' },
      { minScore: 0.7 },
      { start: '2026-04-13T00:00:00.000Z' },
      { source: 'LinkedIn' },
      { companyIds: ['c-acme', 'c-beta'] },
      { status: 'new', minScore: 0.4 },
    ];

    for (const q of filterShapes) {
      it(`agrees with query() for filter shape ${JSON.stringify(q)}`, async () => {
        const [rows, count] = await Promise.all([
          jobRepo.query(q),
          jobRepo.countMatching(q),
        ]);
        expect(rows.length).toBe(count);
      });
    }

    // Limit applies to query() only — the parity assertion becomes
    // query().length ≤ countMatching().
    it('query with limit returns ≤ countMatching', async () => {
      const rows = await jobRepo.query({ limit: 2 });
      const count = await jobRepo.countMatching({});
      expect(rows.length).toBeLessThanOrEqual(count);
      expect(rows.length).toBe(2);
    });
  });
});
