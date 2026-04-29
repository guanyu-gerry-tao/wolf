import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { v1ToV2 } from '../v1ToV2.js';
import { parseProfileToml, isFilled } from '../../../utils/profileToml.js';
import { WOLF_BUILTIN_STORIES } from '../../../utils/storyFields.js';

// v1 → v2 is the most user-visible piece of the workspace schema upgrade:
// it converts the three .md files to a single profile.toml, preserves the
// answers, and backs up the originals so worst case the user has a
// rollback path. These tests run the migration end-to-end on a tmp
// workspace with realistic md fixtures and assert the resulting toml
// content lands the user data in the right v2 fields.

describe('v1 → v2 migration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wolf-mig-v1tov2-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // Helper: lay down a "default" v1 profile with the given .md content.
  async function writeV1Profile(name: string, files: {
    profileMd?: string;
    resumePoolMd?: string;
    standardQuestionsMd?: string;
  }): Promise<void> {
    const profileDir = path.join(tmpDir, 'profiles', name);
    await fs.mkdir(profileDir, { recursive: true });
    if (files.profileMd !== undefined) {
      await fs.writeFile(path.join(profileDir, 'profile.md'), files.profileMd, 'utf-8');
    }
    if (files.resumePoolMd !== undefined) {
      await fs.writeFile(path.join(profileDir, 'resume_pool.md'), files.resumePoolMd, 'utf-8');
    }
    if (files.standardQuestionsMd !== undefined) {
      await fs.writeFile(path.join(profileDir, 'standard_questions.md'), files.standardQuestionsMd, 'utf-8');
    }
  }

  async function readWritten(profileName: string): Promise<string> {
    return fs.readFile(path.join(tmpDir, 'profiles', profileName, 'profile.toml'), 'utf-8');
  }

  // -------------------------------------------------------------------------
  // No-op: missing profiles dir
  // -------------------------------------------------------------------------

  it('is a no-op on a workspace with no profiles directory', async () => {
    // Just create wolf.toml so the workspace looks initialized; no profiles.
    await fs.writeFile(path.join(tmpDir, 'wolf.toml'), 'default = "default"\n', 'utf-8');
    await expect(v1ToV2.run(tmpDir)).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Happy path: profile.md fields → profile.toml fields
  // -------------------------------------------------------------------------

  it('migrates simple profile.md identity / contact / address fields', async () => {
    const profileMd = [
      '# default',
      '',
      '# Identity',
      '',
      '## Legal first name',
      'Gerry',
      '',
      '## Legal last name',
      'Tao',
      '',
      '## Country of citizenship',
      'United States',
      '',
      '# Contact',
      '',
      '## Email',
      'gerry@example.com',
      '',
      '## Phone',
      '+1 555 010 0100',
      '',
      '# Address',
      '',
      '## Full address',
      '123 Main St, San Francisco, CA 94102, USA',
      '',
    ].join('\n');

    await writeV1Profile('default', { profileMd });
    await v1ToV2.run(tmpDir);

    const tomlContent = await readWritten('default');
    const profile = parseProfileToml(tomlContent);
    expect(profile.identity.legal_first_name.trim()).toBe('Gerry');
    expect(profile.identity.legal_last_name.trim()).toBe('Tao');
    expect(profile.identity.country_of_citizenship.trim()).toBe('United States');
    expect(profile.contact.email.trim()).toBe('gerry@example.com');
    expect(profile.contact.phone.trim()).toBe('+1 555 010 0100');
    expect(profile.address.full.trim()).toBe('123 Main St, San Francisco, CA 94102, USA');
  });

  // -------------------------------------------------------------------------
  // standard_questions.md → [form_answers] + [[story]]
  // -------------------------------------------------------------------------

  it('routes form answers and behavioural stories to the right v2 destinations', async () => {
    const standardQuestionsMd = [
      '# Standard Questions',
      '',
      '# Short Answers',
      '',
      "## What's your salary expectation?",
      'Open to discuss',
      '',
      '## How did you hear about us?',
      'A friend who works here',
      '',
      '## Tell me about a time you failed',
      'I shipped a feature without a feature flag and caused an outage. Now I always use flags.',
      '',
      '## Tell me about yourself',
      "I'm a backend engineer who likes building reliable systems.",
      '',
    ].join('\n');

    await writeV1Profile('default', { standardQuestionsMd });
    await v1ToV2.run(tmpDir);

    const profile = parseProfileToml(await readWritten('default'));
    // form_answers gets the short-answer fields verbatim.
    expect(profile.form_answers.salary_expectation.trim()).toBe('Open to discuss');
    expect(profile.form_answers.how_did_you_hear.trim()).toBe('A friend who works here');
    // Stories land on the matching builtin id.
    const failure = profile.story.find((s) => s.id === 'tell_me_about_failure');
    const intro = profile.story.find((s) => s.id === 'tell_me_about_yourself');
    expect(failure!.star_story.trim()).toContain('shipped a feature without a feature flag');
    expect(intro!.star_story.trim()).toContain('backend engineer');
  });

  // Stories the user filled BEFORE wolf added a builtin (or that the
  // user wrote with custom prompt text) get logged + dropped. Test by
  // including an H2 that doesn't match any builtin.
  it('drops H2s that do not match a builtin story (β does not yet support custom)', async () => {
    const standardQuestionsMd = [
      '# Short Answers',
      '',
      '## Some custom question I wrote',
      'My custom answer.',
      '',
    ].join('\n');

    await writeV1Profile('default', { standardQuestionsMd });
    await v1ToV2.run(tmpDir);

    const profile = parseProfileToml(await readWritten('default'));
    // The custom story is not in the array (β doesn't yet support it).
    const customStory = profile.story.find((s) =>
      s.prompt.includes('Some custom question I wrote') ||
      s.star_story.includes('My custom answer.')
    );
    expect(customStory).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // resume_pool.md → coarse experience/project/education/skills
  // -------------------------------------------------------------------------

  it('dumps top-level resume_pool sections into legacy entries / scalar fields', async () => {
    const resumePoolMd = [
      '# Resume Pool',
      '',
      '## Experience',
      '### Software Engineer Intern — Amazon',
      '*2024-06 — 2024-09*',
      '- Reduced latency 40%',
      '- Led TS migration',
      '',
      '## Skills',
      'TypeScript, Python, Go',
      '',
      '## Awards & Honors',
      '- 1st Place — HackMIT 2023',
      '',
    ].join('\n');

    await writeV1Profile('default', { resumePoolMd });
    await v1ToV2.run(tmpDir);

    const profile = parseProfileToml(await readWritten('default'));

    // The Experience section dumps verbatim into one legacy [[experience]]
    // entry. The user is expected to refine into per-role entries by hand.
    const legacy = profile.experience.find((e) => e.id === 'legacy-experience');
    expect(legacy).toBeDefined();
    expect(legacy!.bullets).toContain('Software Engineer Intern — Amazon');
    expect(legacy!.bullets).toContain('Reduced latency 40%');

    // Skills body lands on skills.free_text (scalar).
    expect(profile.skills.free_text).toContain('TypeScript');
    expect(profile.skills.free_text).toContain('Go');

    // Awards body lands on awards.items.
    expect(profile.awards.items).toContain('1st Place — HackMIT 2023');
  });

  // -------------------------------------------------------------------------
  // Backups + cleanup
  // -------------------------------------------------------------------------

  it('writes the original .md files to .wolf/backups/v1/ before deleting them', async () => {
    const profileMd = '# Identity\n\n## Legal first name\nGerry\n';
    const standardQuestionsMd = '## Tell me about a time you failed\nI shipped a feature\n';
    const resumePoolMd = '## Skills\nTypeScript, Go\n';
    await writeV1Profile('default', { profileMd, standardQuestionsMd, resumePoolMd });

    await v1ToV2.run(tmpDir);

    // Backup directory has the originals verbatim.
    const backupDir = path.join(tmpDir, '.wolf', 'backups', 'v1', 'profiles-default');
    expect(await fs.readFile(path.join(backupDir, 'profile.md'), 'utf-8')).toBe(profileMd);
    expect(await fs.readFile(path.join(backupDir, 'standard_questions.md'), 'utf-8')).toBe(standardQuestionsMd);
    expect(await fs.readFile(path.join(backupDir, 'resume_pool.md'), 'utf-8')).toBe(resumePoolMd);

    // Originals are gone from the profile dir.
    const profileDir = path.join(tmpDir, 'profiles', 'default');
    await expect(fs.access(path.join(profileDir, 'profile.md'))).rejects.toThrow();
    await expect(fs.access(path.join(profileDir, 'standard_questions.md'))).rejects.toThrow();
    await expect(fs.access(path.join(profileDir, 'resume_pool.md'))).rejects.toThrow();

    // profile.toml exists.
    await expect(fs.access(path.join(profileDir, 'profile.toml'))).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Multi-profile workspaces (E3 already supports multiple profiles)
  // -------------------------------------------------------------------------

  it('migrates every profile directory independently', async () => {
    await writeV1Profile('default', {
      profileMd: '# Identity\n\n## Email\nfor wolf-default@example.com\n',
    });
    await writeV1Profile('persona-2', {
      profileMd: '# Identity\n\n## Email\nfor wolf-persona-2@example.com\n',
    });

    await v1ToV2.run(tmpDir);

    const defaultProfile = parseProfileToml(await readWritten('default'));
    const persona2Profile = parseProfileToml(await readWritten('persona-2'));
    // Note: 'Email' is in [contact], not [identity]. The fixture has it
    // under # Identity by convention but that's a markdown structural
    // header, not a TOML table. extractH2Content matches H2 by title text
    // alone, ignoring the surrounding H1.
    expect(defaultProfile.contact.email.trim()).toBe('for wolf-default@example.com');
    expect(persona2Profile.contact.email.trim()).toBe('for wolf-persona-2@example.com');
  });

  // -------------------------------------------------------------------------
  // Refusal: profile.toml already exists
  // -------------------------------------------------------------------------

  it('refuses to overwrite an existing profile.toml', async () => {
    await writeV1Profile('default', {
      profileMd: '# Identity\n\n## Email\nme@example.com\n',
    });
    // Pre-create a profile.toml — simulates a partial / re-run scenario.
    await fs.writeFile(
      path.join(tmpDir, 'profiles', 'default', 'profile.toml'),
      'schemaVersion = 2\n',
      'utf-8',
    );

    await expect(v1ToV2.run(tmpDir)).rejects.toThrow(/already has a profile.toml/i);
    // Original profile.md was NOT deleted (rollback-via-not-touching).
    await expect(fs.access(path.join(tmpDir, 'profiles', 'default', 'profile.md'))).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Defaults from the bundled template survive when old md is silent on
  // those fields.
  // -------------------------------------------------------------------------

  it('preserves bundled-template defaults for fields the old md does not mention', async () => {
    // Old profile.md only sets first/last name. veteran_status default
    // ("I am not a protected veteran") and form_answers.salary_expectation
    // default come from the bundled template.
    const profileMd = '# Identity\n\n## Legal first name\nGerry\n';
    await writeV1Profile('default', { profileMd });

    await v1ToV2.run(tmpDir);

    const profile = parseProfileToml(await readWritten('default'));
    expect(profile.identity.legal_first_name.trim()).toBe('Gerry');
    expect(profile.demographics.veteran_status.trim()).toBe('I am not a protected veteran');
    expect(profile.form_answers.salary_expectation.trim().length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Builtin stories all seeded after migration (lazy inject runs on parse)
  // -------------------------------------------------------------------------

  it('produces a profile.toml with all 17 wolf-builtin stories present', async () => {
    await writeV1Profile('default', { profileMd: '# Identity\n## Legal first name\nx\n' });
    await v1ToV2.run(tmpDir);
    const profile = parseProfileToml(await readWritten('default'));
    for (const builtin of WOLF_BUILTIN_STORIES) {
      const found = profile.story.find((s) => s.id === builtin.id);
      expect(found, `missing builtin: ${builtin.id}`).toBeDefined();
    }
  });
});
