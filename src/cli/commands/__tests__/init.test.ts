import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { parse } from 'smol-toml';
import { AppConfigSchema } from '../../../utils/schemas.js';
import { parseProfileToml } from '../../../utils/profileToml.js';

// Mock @inquirer/prompts so tests never open interactive TTY prompts. Init
// no longer collects profile data via prompts (everything is markdown the user
// edits later), but `confirm` is still used for the home-dir warning and the
// wolf.toml overwrite check, and `input` may surface in API-key setup.
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
}));

import { input, confirm, select } from '@inquirer/prompts';
import { init } from '../init.js';

// Helper: create a fresh temp directory path for each test run (not yet on disk).
function makeTempDir(): string {
  return path.join(os.tmpdir(), `wolf-init-test-${randomUUID()}`);
}

// Stub WOLF_ANTHROPIC_API_KEY so init() skips the envSet() call at the end.
const originalApiKey = process.env.WOLF_ANTHROPIC_API_KEY;

// Helper: runs init() with cwd temporarily set to dir, restores cwd afterward,
// then cleans up the temp directory. Assertions must be done inside assertFn
// so they run before the cleanup.
async function runInitIn(dir: string, assertFn: () => Promise<void>): Promise<void> {
  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    await init({ here: true });
  } finally {
    process.chdir(originalCwd);
  }
  try {
    await assertFn();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('init()', () => {
  beforeEach(() => { process.env.WOLF_ANTHROPIC_API_KEY = 'test-key'; });
  afterEach(() => {
    vi.clearAllMocks();
    if (originalApiKey === undefined) {
      delete process.env.WOLF_ANTHROPIC_API_KEY;
    } else {
      process.env.WOLF_ANTHROPIC_API_KEY = originalApiKey;
    }
  });

  // Happy path: fresh workspace — init writes the v2 profile.toml,
  // a wolf.toml pointing at the default profile dir, and the standard sidecar
  // files (.gitignore, CLAUDE.md, AGENTS.md). No data prompts run.
  it('creates wolf.toml, profile.toml, and the attachments dir in a fresh directory', async () => {
    const dir = makeTempDir();
    await fs.mkdir(dir, { recursive: true });

    await runInitIn(dir, async () => {
      // wolf.toml should parse cleanly and point at the conventional default name.
      const raw = await fs.readFile(path.join(dir, 'wolf.toml'), 'utf-8');
      const config = AppConfigSchema.parse(parse(raw));
      expect(config.default).toBe('default');
      expect(config.tailor.model).toBe('anthropic/claude-sonnet-4-6');
      expect(config.fill.model).toBe('anthropic/claude-haiku-4-5-20251001');
      // Fresh init writes the current workspace schema version.
      expect(config.schemaVersion).toBe(3);

      // The v2 single profile.toml replaces the old md trio. It should contain
      // the structural anchors we expect (table headers, builtin stories).
      const profileDir = path.join(dir, 'profiles', 'default');
      const profileToml = await fs.readFile(path.join(profileDir, 'profile.toml'), 'utf-8');
      expect(profileToml).toContain('schemaVersion = 2');
      expect(profileToml).toContain('[identity]');
      expect(profileToml).toContain('[job_preferences]');
      expect(profileToml).toContain('[demographics]');
      expect(profileToml).toContain('[[question]]');
      expect(profileToml).toContain('[[question]]');
      // Old md files should NOT be written by v2 init.
      await expect(fs.access(path.join(profileDir, 'profile.md'))).rejects.toThrow();
      await expect(fs.access(path.join(profileDir, 'resume_pool.md'))).rejects.toThrow();
      await expect(fs.access(path.join(profileDir, 'standard_questions.md'))).rejects.toThrow();

      // attachments/ exists and contains the explanatory README.
      const attachmentsReadme = await fs.readFile(
        path.join(profileDir, 'attachments', 'README.md'), 'utf-8',
      );
      expect(attachmentsReadme).toContain('attachments/');

      // prompts/ is a strategy-only customization surface. The seeded
      // strategy files contain editable policy, while fill remains blank
      // until that milestone has a real strategy surface.
      const promptsReadme = await fs.readFile(path.join(profileDir, 'prompts', 'README.md'), 'utf-8');
      expect(promptsReadme).toContain('strategy prompts');
      const tailoringStrategy = await fs.readFile(path.join(profileDir, 'prompts', 'tailoring-strategy.md'), 'utf-8');
      const resumeStrategy = await fs.readFile(path.join(profileDir, 'prompts', 'resume-strategy.md'), 'utf-8');
      const coverStrategy = await fs.readFile(path.join(profileDir, 'prompts', 'cover-letter-strategy.md'), 'utf-8');
      const fillStrategy = await fs.readFile(path.join(profileDir, 'prompts', 'fill-strategy.md'), 'utf-8');
      expect(tailoringStrategy).toContain('defensible stretch');
      expect(tailoringStrategy).not.toContain('Canonical Job Metadata');
      expect(resumeStrategy).toContain('Tailor aggressively but defensibly');
      expect(coverStrategy).toContain('Default to generic employer wording');
      expect(fillStrategy).toBe('');

      // .gitignore should exclude both data/ and profiles/ to protect PII.
      const gitignore = await fs.readFile(path.join(dir, '.gitignore'), 'utf-8');
      expect(gitignore).toContain('data/');
      expect(gitignore).toContain('profiles/');

      // CLAUDE.md and AGENTS.md should be created with identical content so AI
      // assistants operating in the workspace understand its structure and commands.
      const claudeMd = await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf-8');
      const agentsMd = await fs.readFile(path.join(dir, 'AGENTS.md'), 'utf-8');
      expect(claudeMd).toContain('wolf workspace');
      expect(agentsMd).toBe(claudeMd);

      // Crucially: no data prompts (input/select) ran. Profile data lives in
      // the user-edited MD; init only places skeletons.
      expect(input).not.toHaveBeenCalled();
      expect(select).not.toHaveBeenCalled();
    });
  });

  // Idempotent re-run: an existing profile.toml must not be overwritten.
  it('does not overwrite profile.toml on re-run', async () => {
    const dir = makeTempDir();
    await fs.mkdir(dir, { recursive: true });

    // Pre-create profile.toml with sentinel content before running init.
    const profileDir = path.join(dir, 'profiles', 'default');
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(
      path.join(profileDir, 'profile.toml'),
      'schemaVersion = 2\nsentinel = "already-edited"\n',
      'utf-8',
    );

    await runInitIn(dir, async () => {
      // profile.toml should retain its original content — init must skip writing it.
      const tomlContent = await fs.readFile(path.join(profileDir, 'profile.toml'), 'utf-8');
      expect(tomlContent).toContain('sentinel = "already-edited"');
    });
  });

  // wolf.toml overwrite cancelled: init should bail out without touching anything.
  it('cancels without writing files when user declines to overwrite wolf.toml', async () => {
    const dir = makeTempDir();
    await fs.mkdir(dir, { recursive: true });

    // Pre-create a wolf.toml to trigger the overwrite prompt.
    await fs.writeFile(path.join(dir, 'wolf.toml'), 'default = "old"', 'utf-8');

    // Mock: confirm is called for "Overwrite existing config?" — user says no.
    vi.mocked(confirm).mockResolvedValueOnce(false);

    await runInitIn(dir, async () => {
      // wolf.toml should remain unchanged after the cancelled init.
      const remaining = await fs.readFile(path.join(dir, 'wolf.toml'), 'utf-8');
      expect(remaining).toBe('default = "old"');

      // No profile directory should have been created.
      const profileDirExists = await fs.access(path.join(dir, 'profiles')).then(() => true).catch(() => false);
      expect(profileDirExists).toBe(false);
    });
  });

  // Asserts the `__WOLF_BIN__` placeholder in workspace-claude.md gets
  // substituted at write time. A typo in the placeholder regex (or a forgotten
  // .replace() call) would silently ship the literal token to friends'
  // workspaces — this test pins the contract so the binary name in CLAUDE.md
  // and AGENTS.md tracks the active build.
  it('substitutes __WOLF_BIN__ placeholder in CLAUDE.md / AGENTS.md', async () => {
    const dir = makeTempDir();
    await fs.mkdir(dir, { recursive: true });
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      await init({ here: true });

      for (const filename of ['CLAUDE.md', 'AGENTS.md']) {
        const content = await fs.readFile(path.join(dir, filename), 'utf-8');
        // Placeholder must be fully resolved — never escape into user files.
        expect(content).not.toContain('__WOLF_BIN__');
        // The actual binary name (`wolf` for stable, `wolf-dev` for dev)
        // must appear at least where the substitution happened. Tests run
        // in stable mode by default (no WOLF_BUILD_MODE set), so we expect
        // `wolf init` to materialize.
        expect(content).toContain('wolf init');
      }
    } finally {
      process.chdir(originalCwd);
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('writes instance.mode = dev for --dev workspaces', async () => {
    const dir = makeTempDir();
    process.env.WOLF_BUILD_MODE = 'dev';
    process.env.WOLF_DEV_HOME = dir;

    try {
      await init({ dev: true });

      const raw = await fs.readFile(path.join(dir, 'wolf.toml'), 'utf-8');
      const config = AppConfigSchema.parse(parse(raw));
      expect(config.instance?.mode).toBe('dev');
    } finally {
      delete process.env.WOLF_BUILD_MODE;
      delete process.env.WOLF_DEV_HOME;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // Dev presets are for fast local demos and acceptance debugging. They fill
  // the profile.toml resume/profile data, but must not seed job search rows.
  it('writes the default preset profile for dev-build --preset default workspaces without creating SQLite data', async () => {
    const dir = makeTempDir();
    process.env.WOLF_BUILD_MODE = 'dev';
    process.env.WOLF_DEV_HOME = dir;

    try {
      await init({ preset: 'default' });

      const raw = await fs.readFile(path.join(dir, 'wolf.toml'), 'utf-8');
      const config = AppConfigSchema.parse(parse(raw));
      expect(config.instance?.mode).toBe('dev');

      const profileToml = await fs.readFile(path.join(dir, 'profiles', 'default', 'profile.toml'), 'utf-8');
      const profile = parseProfileToml(profileToml);

      expect(profile.identity.legal_first_name).toBe('John');
      expect(profile.identity.legal_last_name).toBe('Smith');
      expect(profile.contact.email).toBe('john.smith@example.test');
      expect(profile.job_preferences.target_roles).toContain('Software Engineer');
      expect(profile.skills.text).toContain('TypeScript');
      expect(profile.experience).toHaveLength(2);
      expect(profile.experience[0]?.company).toBe('Northbridge Cloud');
      expect(profile.experience.every((entry) => entry.job_title.includes('Intern'))).toBe(true);
      expect(profile.project).toHaveLength(2);
      expect(profile.education[0]?.degree).toBe('M.S. Computer Science');
      expect(profile.education[0]?.school).toBe('Northlake University');
      expect(profile.job_preferences.sponsorship_preferences).toContain('OPT');
      expect(profile.question.find((q) => q.id === 'authorized_to_work')?.answer)
        .toContain('legally authorized');

      await expect(fs.access(path.join(dir, 'data'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(dir, 'data', 'wolf.sqlite'))).rejects.toThrow();
    } finally {
      delete process.env.WOLF_BUILD_MODE;
      delete process.env.WOLF_DEV_HOME;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // Dev preset empty is the blank non-interactive init path.
  it('treats --preset empty as a blank non-interactive workspace', async () => {
    const dir = makeTempDir();
    process.env.WOLF_BUILD_MODE = 'dev';
    process.env.WOLF_DEV_HOME = dir;

    try {
      await init({ preset: 'empty' });

      const raw = await fs.readFile(path.join(dir, 'wolf.toml'), 'utf-8');
      const config = AppConfigSchema.parse(parse(raw));
      expect(config.instance?.mode).toBe('dev');

      const profileToml = await fs.readFile(path.join(dir, 'profiles', 'default', 'profile.toml'), 'utf-8');
      const profile = parseProfileToml(profileToml);
      expect(profile.identity.legal_first_name.trim()).toBe('');
      expect(profile.identity.legal_last_name.trim()).toBe('');
      expect(profile.experience).toHaveLength(0);
      expect(profile.project).toHaveLength(0);
      expect(profile.education).toHaveLength(0);

      await expect(fs.access(path.join(dir, 'profiles', 'default', 'score.md'))).resolves.toBeUndefined();
      expect(input).not.toHaveBeenCalled();
      expect(confirm).not.toHaveBeenCalled();
      expect(select).not.toHaveBeenCalled();
    } finally {
      delete process.env.WOLF_BUILD_MODE;
      delete process.env.WOLF_DEV_HOME;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // Commander passes `true` for an optional value flag written as `--preset`.
  // Treating that as default keeps the dev command short for repeated demos.
  it('treats bare --preset as the default preset', async () => {
    const dir = makeTempDir();
    process.env.WOLF_BUILD_MODE = 'dev';
    process.env.WOLF_DEV_HOME = dir;

    try {
      await init({ preset: true });

      const profileToml = await fs.readFile(path.join(dir, 'profiles', 'default', 'profile.toml'), 'utf-8');
      const profile = parseProfileToml(profileToml);
      expect(profile.identity.legal_first_name).toBe('John');
    } finally {
      delete process.env.WOLF_BUILD_MODE;
      delete process.env.WOLF_DEV_HOME;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // Only `default` exists today. Fail loudly so future preset typos do not
  // quietly create a half-empty workspace that looks like a successful demo.
  it('rejects unknown preset names', async () => {
    const dir = makeTempDir();
    process.env.WOLF_BUILD_MODE = 'dev';
    process.env.WOLF_DEV_HOME = dir;

    try {
      await expect(init({ preset: 'hunter' }))
        .rejects.toThrow('Unknown init preset "hunter"');
    } finally {
      delete process.env.WOLF_BUILD_MODE;
      delete process.env.WOLF_DEV_HOME;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // A non-dev build must not be able to create a dev-marked workspace; otherwise
  // a user or agent could confuse the real binary with the local dev build.
  it('rejects --dev when the binary is not a dev build', async () => {
    delete process.env.WOLF_BUILD_MODE;
    await expect(init({ dev: true, here: true }))
      .rejects.toThrow('--dev requires a dev build');
  });

  // Preset data is intentionally dev-only, even if the caller forgets --dev.
  // A non-dev build should get an error instead of a fake profile.
  it('rejects --preset when the binary is not a dev build', async () => {
    delete process.env.WOLF_BUILD_MODE;
    await expect(init({ preset: 'default', here: true }))
      .rejects.toThrow('--preset requires a dev build');
  });
});
