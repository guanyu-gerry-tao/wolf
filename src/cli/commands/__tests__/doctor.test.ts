import { describe, it, expect, vi } from 'vitest';
import { doctor, formatDoctor } from '../doctor.js';
import type { ProfileRepository } from '../../../repository/profileRepository.js';
import type { Profile } from '../../../utils/types/index.js';
import type { AppContext } from '../../../runtime/appContext.js';
import { DoctorApplicationServiceImpl } from '../../../application/impl/doctorApplicationServiceImpl.js';
import { parseProfileToml, type ProfileToml } from '../../../utils/profileToml.js';
import { profileTomlTemplate } from '../../../utils/profileTomlGenerate.js';

// All doctor tests run against a typed ProfileToml. We start from the
// bundled template (so every field has the canonical default) and override
// the slice the test cares about. This keeps tests readable and lets
// minor schema additions ride through without per-test churn.

function makeCtx(opts: {
  profile?: Profile;
  toml?: ProfileToml;
  tomlOverrides?: (base: ProfileToml) => ProfileToml;
}): AppContext {
  const base = parseProfileToml(profileTomlTemplate);
  // Helper to build a "fully-filled" ProfileToml that clears every
  // doctor check by default — tests then deliberately empty fields to
  // exercise the failure paths.
  const filled: ProfileToml = {
    ...base,
    identity: {
      ...base.identity,
      legal_first_name: 'Alex',
      legal_last_name: 'Rivera',
      country_of_citizenship: 'United States',
    },
    contact: { ...base.contact, email: 'a@example.test', phone: '+1 555 0100' },
    address: { ...base.address, full: '123 Main St, SF, CA 94102, USA' },
    links: { ...base.links, first: 'https://linkedin.com/in/alex' },
    job_preferences: {
      ...base.job_preferences,
      target_roles: '- SWE',
      target_locations: '- SF Bay Area',
    },
    // Five filled "resume entries" so checkResumeContent passes:
    // 1 experience + 4 skills buckets.
    experience: [{
      id: 'acme-2024',
      job_title: 'SWE',
      company: 'Acme',
      start: '2022',
      end: '2025',
      location: '',
      bullets: '- Built distributed systems',
      subnote: '',
    }],
    skills: {
      languages: 'TypeScript',
      frameworks: 'React',
      tools: 'Git',
      domains: 'Backend',
      free_text: '',
    },
    // Builtin questions: pre-seed REQ short answers (former form_answers)
    // and three behavioral STAR stories so doctor's question check passes.
    question: base.question.map((q) => {
      const reqShortAnswer: Record<string, string> = {
        authorized_to_work: 'Yes',
        require_sponsorship: 'No',
        willing_to_relocate: 'Yes',
      };
      if (q.id in reqShortAnswer) return { ...q, answer: reqShortAnswer[q.id] };
      if (['tell_me_about_yourself', 'tell_me_about_failure', 'biggest_strength'].includes(q.id)) {
        return { ...q, answer: 'A real STAR answer.' };
      }
      return q;
    }),
  };

  const tomlValue = opts.toml ?? (opts.tomlOverrides ? opts.tomlOverrides(filled) : filled);

  const profile: Profile = opts.profile ?? { name: 'default', md: '' };

  const repo = {
    get: vi.fn(),
    getDefault: vi.fn().mockResolvedValue(profile),
    list: vi.fn(),
    getProfileToml: vi.fn().mockResolvedValue(tomlValue),
    getProfileMd: vi.fn().mockResolvedValue(profile.md),
    getResumePool: vi.fn(),
    getStandardQuestions: vi.fn(),
    getAttachmentsList: vi.fn().mockResolvedValue([]),
  } as unknown as ProfileRepository;

  return {
    profileRepository: repo,
    doctorApp: new DoctorApplicationServiceImpl(repo),
  } as unknown as AppContext;
}

describe('doctor()', () => {
  // Happy path: every check passes. The default `makeCtx({})` builds a
  // fully-populated profile to exercise this baseline.
  it('reports ready=true when profile + resume + stories are all filled', async () => {
    const report = await doctor({}, makeCtx({}));
    // Workspace-level runtime checks (API key, Chromium) may fail in CI;
    // assert per-file readiness directly so this isn't environment-coupled.
    const profileCheck = report.checks.find(c => c.file === 'profile.toml')!;
    const poolCheck = report.checks.find(c => c.file === 'resume content')!;
    const sqCheck = report.checks.find(c => c.file === 'questions')!;
    expect(profileCheck.ready).toBe(true);
    expect(poolCheck.ready).toBe(true);
    expect(sqCheck.ready).toBe(true);
    expect(report.profileName).toBe('default');
  });

  // REQUIRED scalar field empty → profile.toml fails with the path listed.
  it('flags missing REQUIRED profile fields by dot-path', async () => {
    const ctx = makeCtx({
      tomlOverrides: (base) => ({
        ...base,
        contact: { ...base.contact, phone: '' },
      }),
    });
    const report = await doctor({}, ctx);
    const profileCheck = report.checks.find(c => c.file === 'profile.toml')!;
    expect(profileCheck.ready).toBe(false);
    // The doctor's missing list is "<path> — <help>"; just check the path.
    expect(profileCheck.missing.some(m => m.startsWith('contact.phone'))).toBe(true);
  });

  // Resume content too sparse → resume-content check fails.
  it('flags resume content when total entries / skill groups is below the floor', async () => {
    const ctx = makeCtx({
      tomlOverrides: (base) => ({
        ...base,
        experience: [],  // drop the seed experience
        skills: {
          ...base.skills,
          languages: '',
          frameworks: '',
          tools: '',
          domains: '',
          free_text: '',
        },
      }),
    });
    const report = await doctor({}, ctx);
    const poolCheck = report.checks.find(c => c.file === 'resume content')!;
    expect(poolCheck.ready).toBe(false);
    expect(poolCheck.missing[0]).toMatch(/0 entries/);
  });

  // Fewer than 3 builtin stories answered → stories check fails.
  it('flags stories when too few builtin stories have been answered', async () => {
    const ctx = makeCtx({
      tomlOverrides: (base) => ({
        ...base,
        question: base.question.map(s => ({ ...s, answer: '' })),  // empty all
      }),
    });
    const report = await doctor({}, ctx);
    const sqCheck = report.checks.find(c => c.file === 'questions')!;
    expect(sqCheck.ready).toBe(false);
    expect(sqCheck.missing[0]).toMatch(/0 \/ 23 builtin questions answered/);
  });

  // Empty (whitespace-only) values count as not-filled — same as totally
  // missing. Mirrors the isFilled() contract.
  it('treats whitespace-only field values as missing', async () => {
    const ctx = makeCtx({
      tomlOverrides: (base) => ({
        ...base,
        contact: { ...base.contact, email: '   \n  \n   ' },
      }),
    });
    const report = await doctor({}, ctx);
    const profileCheck = report.checks.find(c => c.file === 'profile.toml')!;
    expect(profileCheck.ready).toBe(false);
    expect(profileCheck.missing.some(m => m.startsWith('contact.email'))).toBe(true);
  });

  // The Doctor pulls REQUIRED fields from the same PROFILE_FIELDS table
  // that drives `wolf profile fields --required`. Fresh-init profile.toml
  // (no fields filled) should flag every REQUIRED field, not just some.
  it('flags every REQUIRED field on a totally empty profile', async () => {
    const ctx = makeCtx({
      // The bundled template parsed unmodified — every REQUIRED field empty.
      toml: parseProfileToml(profileTomlTemplate),
    });
    const report = await doctor({}, ctx);
    const profileCheck = report.checks.find(c => c.file === 'profile.toml')!;
    expect(profileCheck.ready).toBe(false);
    // Every REQUIRED field should be flagged (not just a subset).
    const { REQUIRED_PROFILE_FIELDS } = await import('../../../utils/profileFields.js');
    expect(profileCheck.missing.length).toBe(REQUIRED_PROFILE_FIELDS.length);
  });
});

describe('formatDoctor()', () => {
  // Pure formatter: passes a ready report through to a green status block.
  it('renders a READY summary with check-marks for each file', () => {
    const text = formatDoctor({
      profileName: 'default',
      ready: true,
      checks: [
        { file: 'profile.toml', ready: true, missing: [], hint: 'all good' },
        { file: 'resume content', ready: true, missing: [], hint: 'all good' },
        { file: 'questions', ready: true, missing: [], hint: 'all good' },
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
        { file: 'profile.toml', ready: false, missing: ['contact.phone', 'contact.email'], hint: 'fill these' },
        { file: 'resume content', ready: true, missing: [], hint: 'OK' },
        { file: 'questions', ready: true, missing: [], hint: 'OK' },
      ],
    });
    expect(text).toMatch(/Status: NOT READY/);
    expect(text).toMatch(/✗ profile\.toml/);
    expect(text).toMatch(/- contact\.phone/);
    expect(text).toMatch(/- contact\.email/);
  });
});
