import { describe, it, expect, vi } from 'vitest';
import { jobList, formatJobList } from '../list.js';
import type { AppContext } from '../../../cli/appContext.js';
import type { Job, JobQuery } from '../../../types/job.js';
import type { Company } from '../../../types/company.js';
import type { JobListResult } from '../../../types/commands.js';

// `wolf job list` is the single place where filters, limits, and company-name
// resolution meet. Tests here cover both the happy path (SQL filters pass
// through, slim items returned) and the boundary behaviors that protect the
// dashboard/list split: default limit, --all override, empty-match short-
// circuit for company substring, and "N more" footer accounting.

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    title: 'SWE',
    companyId: 'company-1',
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
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...overrides,
  };
}

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-1',
    name: 'Acme',
    domain: null,
    linkedinUrl: null,
    size: null,
    industry: null,
    headquartersLocation: null,
    notes: null,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...overrides,
  };
}

// Build a minimal ctx with only the fields jobList uses.
function makeCtx(opts: {
  jobs: Job[];
  companies: Company[];
  totalMatching?: number;
} = { jobs: [], companies: [] }): AppContext {
  const total = opts.totalMatching ?? opts.jobs.length;
  const companiesById = new Map(opts.companies.map((c) => [c.id, c]));
  return {
    jobRepository: {
      query: vi.fn(async (_q: JobQuery) => opts.jobs),
      countMatching: vi.fn(async () => total),
    },
    companyRepository: {
      get: vi.fn(async (id: string) => companiesById.get(id) ?? null),
      query: vi.fn(async () => opts.companies),
    },
  } as unknown as AppContext;
}

describe('jobList()', () => {
  // Happy path: slim items carry company name (not id), and the filter shape
  // from options flows through to JobRepository.query unchanged.
  it('returns slim items with resolved company names and honors filters', async () => {
    const ctx = makeCtx({
      jobs: [makeJob({ id: 'j1', title: 'SWE', status: 'reviewed', score: 0.8 })],
      companies: [makeCompany({ id: 'company-1', name: 'Acme' })],
    });
    const result = await jobList({ status: 'reviewed', minScore: 0.5 }, ctx);
    expect(result.jobs).toEqual([
      {
        id: 'j1',
        company: 'Acme',
        title: 'SWE',
        status: 'reviewed',
        score: 0.8,
        createdAt: '2026-04-18T00:00:00.000Z',
      },
    ]);
    // Filter shape passed to the repo must reflect the options.
    const query = (ctx.jobRepository.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(query.status).toBe('reviewed');
    expect(query.minScore).toBe(0.5);
  });

  // Company names must be resolved only once per unique companyId — guards
  // against N+1 lookups when a page of 20 jobs shares a handful of companies.
  it('caches company name lookups across jobs sharing a companyId', async () => {
    const ctx = makeCtx({
      jobs: [
        makeJob({ id: 'j1', companyId: 'c1' }),
        makeJob({ id: 'j2', companyId: 'c1' }),
        makeJob({ id: 'j3', companyId: 'c2' }),
      ],
      companies: [
        makeCompany({ id: 'c1', name: 'Alpha' }),
        makeCompany({ id: 'c2', name: 'Beta' }),
      ],
    });
    await jobList({}, ctx);
    // Only two distinct companyIds in the page → two repo lookups, not three.
    expect((ctx.companyRepository.get as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  // Default limit guards terminal overflow: without --limit, the command
  // caps output so a 1000-row DB doesn't firehose the scrollback. There is
  // no --all escape hatch by design — users who want more pass --limit N.
  it('applies DEFAULT_JOB_LIST_LIMIT when no limit is given', async () => {
    const ctx = makeCtx({ jobs: [], companies: [] });
    await jobList({}, ctx);
    const query = (ctx.jobRepository.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(query.limit).toBe(20);
  });

  // Explicit --limit overrides the default.
  it('honors an explicit limit', async () => {
    const ctx = makeCtx({ jobs: [], companies: [] });
    await jobList({ limit: 5 }, ctx);
    const query = (ctx.jobRepository.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(query.limit).toBe(5);
  });

  // --search: the array of terms passes through to JobQuery unchanged.
  // Repo-layer tests verify the actual SQL predicate against real data.
  it('passes --search terms through to JobQuery.search', async () => {
    const ctx = makeCtx({ jobs: [], companies: [] });
    await jobList({ search: ['Google', 'Apple'] }, ctx);
    const query = (ctx.jobRepository.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(query.search).toEqual(['Google', 'Apple']);
  });

  // Empty --search array should not be sent to the repo — treat it as absent
  // so we don't pay for an unnecessary join at the SQL layer.
  it('does not pass --search to the repo when the array is empty', async () => {
    const ctx = makeCtx({ jobs: [], companies: [] });
    await jobList({ search: [] }, ctx);
    const query = (ctx.jobRepository.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // The command is allowed to omit the field or pass through the empty
    // array — what matters is that the repo sees no positive-length search.
    const effective = query.search ?? [];
    expect(effective.length).toBe(0);
  });

  // When the DB has more matching rows than the returned page, limited=true
  // and totalMatching reflects the real total — that's what powers the
  // "... N more — use --all" footer in the CLI layer.
  it('reports limited=true and the full match count when result is truncated', async () => {
    const ctx = makeCtx({
      jobs: [makeJob({ id: 'j1' })],
      companies: [makeCompany({ id: 'company-1', name: 'Acme' })],
      totalMatching: 173,
    });
    const result = await jobList({ limit: 1 }, ctx);
    expect(result.limited).toBe(true);
    expect(result.totalMatching).toBe(173);
    expect(result.jobs).toHaveLength(1);
  });

  // When result size equals totalMatching, limited=false — no footer shown.
  it('reports limited=false when the page contains every matching row', async () => {
    const ctx = makeCtx({
      jobs: [makeJob({ id: 'j1' })],
      companies: [makeCompany({ id: 'company-1', name: 'Acme' })],
      totalMatching: 1,
    });
    const result = await jobList({}, ctx);
    expect(result.limited).toBe(false);
  });

  // Unknown companyId (orphaned data from a deleted company) must not crash
  // — surface a placeholder so the list still renders.
  it('falls back to a placeholder name for missing companies', async () => {
    const ctx = makeCtx({
      jobs: [makeJob({ id: 'j1', companyId: 'ghost' })],
      companies: [],
    });
    const result = await jobList({}, ctx);
    expect(result.jobs[0].company).toBe('<unknown:ghost>');
  });

  // Input validation — every filter that reaches SQL must survive a
  // typo-check first. Without these the user types `--status aplied` and
  // sees an empty list instead of a helpful error, which is a worse UX
  // than a hard failure.
  describe('input validation', () => {
    // Bad status string → throw with the valid list, not a silent empty.
    it('rejects an unknown --status value with the valid list in the message', async () => {
      const ctx = makeCtx({ jobs: [], companies: [] });
      // "aplied" is a common typo — exercise that exact shape.
      await expect(jobList({ status: 'aplied' as never }, ctx))
        .rejects.toThrow(/Invalid --status "aplied"/);
      await expect(jobList({ status: 'aplied' as never }, ctx))
        .rejects.toThrow(/applied_previously/);
    });

    // Array form must validate each entry, not just the first.
    it('rejects an unknown entry inside an array --status', async () => {
      const ctx = makeCtx({ jobs: [], companies: [] });
      await expect(jobList({ status: ['applied', 'bogus' as never] }, ctx))
        .rejects.toThrow(/Invalid --status "bogus"/);
    });

    // parseFloat('abc') = NaN; without validation, NaN reaches SQL and
    // matches nothing silently. Must reject explicitly.
    it('rejects a non-finite --min-score (NaN)', async () => {
      const ctx = makeCtx({ jobs: [], companies: [] });
      await expect(jobList({ minScore: Number.NaN }, ctx))
        .rejects.toThrow(/--min-score must be a finite number/);
    });

    // Garbage date strings on --start must error out rather than producing
    // weird lexicographic comparisons against createdAt.
    it('rejects an unparseable --start value', async () => {
      const ctx = makeCtx({ jobs: [], companies: [] });
      await expect(jobList({ start: 'not-a-date' }, ctx))
        .rejects.toThrow(/--start must be a valid ISO-8601 date/);
    });

    // Same protection for --end.
    it('rejects an unparseable --end value', async () => {
      const ctx = makeCtx({ jobs: [], companies: [] });
      await expect(jobList({ end: 'tomorrow' }, ctx))
        .rejects.toThrow(/--end must be a valid ISO-8601 date/);
    });

    // Valid dates in any parseable format must be accepted AND normalized
    // to canonical ISO-8601 so lexicographic comparison on createdAt works.
    it('accepts a plain YYYY-MM-DD --start and normalizes it to ISO', async () => {
      const ctx = makeCtx({ jobs: [], companies: [] });
      await jobList({ start: '2026-04-01' }, ctx);
      const query = (ctx.jobRepository.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(query.start).toBe('2026-04-01T00:00:00.000Z');
    });

    // --end normalizes the same way as --start.
    it('accepts a plain YYYY-MM-DD --end and normalizes it to ISO', async () => {
      const ctx = makeCtx({ jobs: [], companies: [] });
      await jobList({ end: '2026-04-30' }, ctx);
      const query = (ctx.jobRepository.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(query.end).toBe('2026-04-30T00:00:00.000Z');
    });

    // Non-integer or zero limits reach commander as a broken --limit flag
    // (or a programmatic caller passing wrong type). Reject with a clear
    // message instead of letting SQL see a garbage LIMIT clause.
    it('rejects a non-integer or non-positive --limit', async () => {
      const ctx = makeCtx({ jobs: [], companies: [] });
      await expect(jobList({ limit: 0 }, ctx))
        .rejects.toThrow(/--limit must be a positive integer/);
      await expect(jobList({ limit: 1.5 }, ctx))
        .rejects.toThrow(/--limit must be a positive integer/);
    });

    // Blank --search terms would turn into `LIKE '%%'` which matches every
    // row — a silent footgun. Reject explicitly.
    it('rejects an empty-string --search term', async () => {
      const ctx = makeCtx({ jobs: [], companies: [] });
      await expect(jobList({ search: ['   '] }, ctx))
        .rejects.toThrow(/--search terms must be non-empty strings/);
    });
  });
});

// The formatter is the human-facing contract — table shape, overflow footer,
// empty-state message. Keeping these as pure-function tests means we verify
// the output shape without spinning up an AppContext or a real database.
describe('formatJobList()', () => {
  function sampleResult(overrides: Partial<JobListResult> = {}): JobListResult {
    return {
      jobs: [
        {
          id: 'abcdef1234567890',
          company: 'Acme',
          title: 'SWE',
          status: 'reviewed',
          score: 0.8,
          createdAt: '2026-04-18T00:00:00.000Z',
        },
      ],
      totalMatching: 1,
      limited: false,
      ...overrides,
    };
  }

  // Empty result must produce the friendly `No jobs match.` line, not an
  // empty string or just the header row.
  it('renders empty-state message when no jobs match', () => {
    expect(formatJobList({ jobs: [], totalMatching: 0, limited: false })).toBe('No jobs match.');
  });

  // Happy path: header row + one data row, ID truncated to 8 chars, score
  // rendered with one decimal, columns aligned by the widest cell.
  it('renders header + rows with 8-char IDs and one-decimal scores', () => {
    const out = formatJobList(sampleResult());
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/^ID\s+COMPANY\s+TITLE\s+STATUS\s+SCORE$/);
    expect(lines[1]).toContain('abcdef12');  // truncated to ID_WIDTH=8
    expect(lines[1]).not.toContain('abcdef1234');
    expect(lines[1]).toContain('0.8');        // score formatted to 1 decimal
    expect(lines[1]).toContain('Acme');
    expect(lines[1]).toContain('reviewed');
  });

  // Null score renders as `-` so the column stays present and aligned for
  // unscored jobs (common before `wolf score` runs on them).
  it('renders null score as "-"', () => {
    const out = formatJobList(sampleResult({
      jobs: [{
        id: 'x', company: 'Co', title: 'T', status: 'new', score: null,
        createdAt: '2026-04-18T00:00:00.000Z',
      }],
    }));
    expect(out).toContain(' -');
  });

  // Overflow footer must appear when the page size is smaller than the
  // total. The count is the exact remainder, not the total matching.
  it('appends overflow footer with remainder count when limited', () => {
    const out = formatJobList(sampleResult({ totalMatching: 173, limited: true }));
    expect(out).toContain('... 172 more — use --limit <n> to see more');
  });

  // No footer when the page is the full set — avoids misleading users into
  // thinking there are more rows hiding.
  it('omits footer when result is not limited', () => {
    const out = formatJobList(sampleResult({ limited: false }));
    expect(out).not.toContain('more —');
  });
});
