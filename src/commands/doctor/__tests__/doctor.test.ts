import { describe, it, expect, vi } from 'vitest';
import { doctor, formatDoctor } from '../index.js';
import type { ProfileRepository } from '../../../repository/profileRepository.js';
import type { Profile } from '../../../utils/types/index.js';
import type { AppContext } from '../../../runtime/appContext.js';
import { DoctorApplicationServiceImpl } from '../../../application/impl/doctorApplicationServiceImpl.js';

// Minimal AppContext stub — doctor() only ever touches profileRepository,
// wired through a real DoctorApplicationServiceImpl.
function makeCtx(opts: {
  profile: Profile;
  resumePool: string;
  standardQuestions: string;
}): AppContext {
  const repo = {
    get: vi.fn(),
    getDefault: vi.fn().mockResolvedValue(opts.profile),
    list: vi.fn(),
    getProfileMd: vi.fn().mockResolvedValue(opts.profile.md),
    getResumePool: vi.fn().mockResolvedValue(opts.resumePool),
    getStandardQuestions: vi.fn().mockResolvedValue(opts.standardQuestions),
    getAttachmentsList: vi.fn().mockResolvedValue([]),
  } as unknown as ProfileRepository;
  return {
    profileRepository: repo,
    doctorApp: new DoctorApplicationServiceImpl(repo),
  } as unknown as AppContext;
}

// Convenience: profile with all REQUIRED H2 sections filled.
const FILLED_PROFILE: Profile = {
  name: 'default',
  md: [
    '# Identity',
    '## Legal first name', 'Alex',
    '## Legal last name', 'Rivera',
    '# Contact',
    '## Email', 'a@example.test',
    '## Phone', '+1 555 0100',
  ].join('\n'),
};

// 5 substantive (non-blank, non-heading) lines: clears the POOL_MIN_LINES floor.
// (`### ...` is a heading per `startsWith('#')` and is not counted.)
const FILLED_POOL = [
  '## Experience',
  '### SWE — Acme',
  '*2024*',
  '- Built things.',
  '- Fixed things.',
  '- Shipped things.',
  '- Owned the on-call rotation.',
  '- Migrated legacy ETL.',
].join('\n');

const FILLED_SQ = [
  '## What\'s your salary expectation?', 'Open to discuss.',
  '## How did you hear about us?', 'LinkedIn.',
  '## Why this company?', 'Mission-aligned.',
  '## Why this role?', 'Backend depth.',
].join('\n');

describe('doctor()', () => {
  // Happy path: every file passes its readiness criterion.
  it('reports ready=true when profile + pool + questions are all filled', async () => {
    const report = await doctor({}, makeCtx({
      profile: FILLED_PROFILE,
      resumePool: FILLED_POOL,
      standardQuestions: FILLED_SQ,
    }));
    expect(report.ready).toBe(true);
    expect(report.checks.every(c => c.ready)).toBe(true);
    expect(report.profileName).toBe('default');
  });

  // profile.md missing REQUIRED H2 → that file fails, overall ready=false.
  it('flags missing REQUIRED profile fields by name', async () => {
    const profileMissingPhone: Profile = {
      name: 'default',
      md: '## Legal first name\nAlex\n## Legal last name\nRivera\n## Email\na@example.test\n',
    };
    const report = await doctor({}, makeCtx({
      profile: profileMissingPhone,
      resumePool: FILLED_POOL,
      standardQuestions: FILLED_SQ,
    }));
    expect(report.ready).toBe(false);
    const profileCheck = report.checks.find(c => c.file === 'profile.md')!;
    expect(profileCheck.ready).toBe(false);
    expect(profileCheck.missing).toContain('Phone');
  });

  // resume_pool below the substantive-line floor → that file fails.
  it('flags resume pool when substantive line count is below the floor', async () => {
    const sparsePool = [
      '## Experience',
      '### SWE — Acme',
      '*2024*',
      '- Bullet one.',
    ].join('\n');  // only 3 substantive lines, floor is 5
    const report = await doctor({}, makeCtx({
      profile: FILLED_PROFILE,
      resumePool: sparsePool,
      standardQuestions: FILLED_SQ,
    }));
    const poolCheck = report.checks.find(c => c.file === 'resume_pool.md')!;
    expect(poolCheck.ready).toBe(false);
    // Pool fixture had 1 date line + 1 bullet = 2 substantive lines (the
    // ### heading is filtered out). Sanity-check that the count surfaces.
    expect(poolCheck.missing[0]).toMatch(/2 substantive lines/);
  });

  // standard_questions with fewer than 3 answered H2s → that file fails.
  it('flags standard_questions when too few H2 sections have answers', async () => {
    const sparseSQ = [
      '## What\'s your salary expectation?', 'Open to discuss.',
      '## How did you hear about us?', 'LinkedIn.',
      '## Why this company?', '> [!IMPORTANT]', '> write a flexible template',
      '## Why this role?', '> [!IMPORTANT]', '> write a flexible template',
    ].join('\n');  // 2 answered, 4 total
    const report = await doctor({}, makeCtx({
      profile: FILLED_PROFILE,
      resumePool: FILLED_POOL,
      standardQuestions: sparseSQ,
    }));
    const sqCheck = report.checks.find(c => c.file === 'standard_questions.md')!;
    expect(sqCheck.ready).toBe(false);
    expect(sqCheck.missing[0]).toMatch(/2 \/ 4/);
  });

  // Regression: wolf init writes profile.md with each REQUIRED H2 followed
  // by a `> [!IMPORTANT]` callout. doctor must strip those before checking
  // — otherwise it reports fresh-init profiles as ready and fools the user.
  it('flags REQUIRED profile fields whose body is only a > [!IMPORTANT] callout (fresh init template state)', async () => {
    const calloutOnlyProfile: Profile = {
      name: 'default',
      md: [
        '# Identity',
        '## Legal first name',
        '> [!IMPORTANT]',
        '> you must answer; AI cannot guess this.',
        '## Legal last name',
        '> [!IMPORTANT]',
        '> you must answer; AI cannot guess this.',
        '# Contact',
        '## Email',
        '> [!IMPORTANT]',
        '> you must answer; AI cannot guess this.',
        '## Phone',
        '> [!IMPORTANT]',
        '> you must answer; AI cannot guess this.',
      ].join('\n'),
    };
    const report = await doctor({}, makeCtx({
      profile: calloutOnlyProfile,
      resumePool: FILLED_POOL,
      standardQuestions: FILLED_SQ,
    }));
    const profileCheck = report.checks.find(c => c.file === 'profile.md')!;
    expect(profileCheck.ready).toBe(false);
    // All four REQUIRED fields should be flagged, not just one.
    expect(profileCheck.missing).toEqual(
      expect.arrayContaining(['Legal first name', 'Legal last name', 'Email', 'Phone']),
    );
  });

  // > [!XYZ] alert blocks should be stripped before counting; an H2 that
  // contains ONLY a callout body counts as unanswered.
  it('treats H2 sections whose only body is a > [!XYZ] callout as unanswered', async () => {
    const onlyCalloutSQ = [
      '## Q1', '> [!IMPORTANT]', '> please answer this',
      '## Q2', '> [!TIP]', '> sample default',
      '## Q3', 'Real answer here.',
    ].join('\n');
    const report = await doctor({}, makeCtx({
      profile: FILLED_PROFILE,
      resumePool: FILLED_POOL,
      standardQuestions: onlyCalloutSQ,
    }));
    const sqCheck = report.checks.find(c => c.file === 'standard_questions.md')!;
    // Only Q3 has a real answer; Q1 and Q2 are callout-only after strip.
    expect(sqCheck.missing[0]).toMatch(/1 \/ 3/);
  });
});

describe('formatDoctor()', () => {
  // Pure formatter: passes a ready report through to a green status block.
  it('renders a READY summary with check-marks for each file', () => {
    const text = formatDoctor({
      profileName: 'default',
      ready: true,
      checks: [
        { file: 'profile.md', ready: true, missing: [], hint: 'all good' },
        { file: 'resume_pool.md', ready: true, missing: [], hint: 'all good' },
        { file: 'standard_questions.md', ready: true, missing: [], hint: 'all good' },
      ],
    });
    expect(text).toMatch(/Status: READY/);
    expect((text.match(/✓/g) ?? []).length).toBe(3);
    expect(text).not.toMatch(/✗/);
  });

  // Failure path: render NOT READY plus the user-facing fix hint at the bottom.
  it('renders a NOT READY summary with a fix hint and missing-item bullets', () => {
    const text = formatDoctor({
      profileName: 'default',
      ready: false,
      checks: [
        { file: 'profile.md', ready: false, missing: ['Phone', 'Email'], hint: 'fill these' },
        { file: 'resume_pool.md', ready: true, missing: [], hint: 'OK' },
        { file: 'standard_questions.md', ready: true, missing: [], hint: 'OK' },
      ],
    });
    expect(text).toMatch(/Status: NOT READY/);
    expect(text).toMatch(/✗ profile\.md/);
    expect(text).toMatch(/- Phone/);
    expect(text).toMatch(/- Email/);
    expect(text).toMatch(/Open profiles\/default\/profile\.md/);
  });
});
