import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { parse } from 'smol-toml';
import { AppConfigSchema, UserProfileSchema } from '../../../utils/schemas.js';

// Mock @inquirer/prompts so tests never open interactive TTY prompts.
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
}));

import { input, confirm, select } from '@inquirer/prompts';
import { init } from '../index.js';

// Helper: create a fresh temp directory path for each test run (not yet on disk).
function makeTempDir(): string {
  return path.join(os.tmpdir(), `wolf-init-test-${randomUUID()}`);
}

// Stub WOLF_ANTHROPIC_API_KEY so init() skips the envSet() call at the end.
// Without this, tests fail in CI where the key is absent — input() runs out of
// mock responses and throws on undefined.trim().
const originalApiKey = process.env.WOLF_ANTHROPIC_API_KEY;

// Default mock answers matching the interactive prompts in the order they fire.
// The order must stay in sync with the input() / select() / confirm() call sequence in init().
function setupDefaultMocks(): void {
  // input calls in order:
  //   legalFirstName, legalMiddleName, legalLastName, preferredName, pronouns,
  //   email, phone, firstUrl, secondUrl, thirdUrl, targetRoles, targetLocations
  vi.mocked(input)
    .mockResolvedValueOnce('Alex')              // legalFirstName
    .mockResolvedValueOnce('')                  // legalMiddleName (skip)
    .mockResolvedValueOnce('Rivera')            // legalLastName
    .mockResolvedValueOnce('')                  // preferredName (skip → falls back to legalFirstName)
    .mockResolvedValueOnce('')                  // pronouns (skip)
    .mockResolvedValueOnce('alex@example.com')  // email
    .mockResolvedValueOnce('+1 555 000 0000')   // phone
    .mockResolvedValueOnce('')                  // firstUrl (skip)
    .mockResolvedValueOnce('')                  // secondUrl (skip)
    .mockResolvedValueOnce('')                  // thirdUrl (skip)
    .mockResolvedValueOnce('Software Engineer') // targetRoles
    .mockResolvedValueOnce('Remote');           // targetLocations

  // select calls in order: immigrationStatus, willingToRelocate
  vi.mocked(select)
    .mockResolvedValueOnce('no limit')  // immigrationStatus
    .mockResolvedValueOnce('no');       // willingToRelocate
}

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
  // Set a fake API key so init() skips the envSet() call at the end.
  // Without this, tests fail in CI where the key is absent — input() runs out
  // of mock responses and throws on undefined.trim().
  beforeEach(() => { process.env.WOLF_ANTHROPIC_API_KEY = 'test-key'; });
  afterEach(() => {
    vi.clearAllMocks();
    if (originalApiKey === undefined) {
      delete process.env.WOLF_ANTHROPIC_API_KEY;
    } else {
      process.env.WOLF_ANTHROPIC_API_KEY = originalApiKey;
    }
  });

  // Happy path: fresh workspace — all expected files should be created with valid content.
  it('creates wolf.toml, profile.toml, and resume_pool.md in a fresh directory', async () => {
    const dir = makeTempDir();
    await fs.mkdir(dir, { recursive: true });
    setupDefaultMocks();

    await runInitIn(dir, async () => {
      // wolf.toml should parse cleanly with the current AppConfigSchema.
      const raw = await fs.readFile(path.join(dir, 'wolf.toml'), 'utf-8');
      const config = AppConfigSchema.parse(parse(raw));
      expect(config.defaultProfileId).toBe('default');
      expect(config.tailor.model).toBe('anthropic/claude-sonnet-4-6');
      expect(config.fill.model).toBe('anthropic/claude-haiku-4-5-20251001');

      // profile.toml should round-trip through UserProfileSchema with the entered values.
      const profileRaw = await fs.readFile(
        path.join(dir, 'profiles', 'default', 'profile.toml'), 'utf-8'
      );
      const profile = UserProfileSchema.parse(parse(profileRaw));
      expect(profile.legalFirstName).toBe('Alex');
      expect(profile.legalLastName).toBe('Rivera');
      // Optional name fields skipped → null after parse, "" in serialized TOML.
      expect(profile.legalMiddleName).toBeNull();
      expect(profile.preferredName).toBeNull();
      expect(profile.pronouns).toBeNull();
      expect(profile.email).toBe('alex@example.com');
      expect(profile.phone).toBe('+1 555 000 0000');
      expect(profile.immigrationStatus).toBe('no limit');
      expect(profile.willingToRelocate).toBe('no');
      expect(profile.targetRoles).toEqual(['Software Engineer']);
      expect(profile.targetLocations).toEqual(['Remote']);
      // Empty URL inputs should be stored as null, not empty string.
      expect(profile.firstUrl).toBeNull();
      expect(profile.secondUrl).toBeNull();
      expect(profile.thirdUrl).toBeNull();

      // resume_pool.md should exist as a starter template.
      const poolExists = await fs.access(
        path.join(dir, 'profiles', 'default', 'resume_pool.md')
      ).then(() => true).catch(() => false);
      expect(poolExists).toBe(true);

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
    });
  });

  // Idempotent re-run: profile.toml and resume_pool.md that already exist must not be overwritten.
  it('does not overwrite profile.toml or resume_pool.md on re-run', async () => {
    const dir = makeTempDir();
    await fs.mkdir(dir, { recursive: true });

    // Pre-create profile files with known sentinel content before running init.
    const profileDir = path.join(dir, 'profiles', 'default');
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(path.join(profileDir, 'profile.toml'), 'id = "existing"', 'utf-8');
    await fs.writeFile(path.join(profileDir, 'resume_pool.md'), '# existing', 'utf-8');

    // wolf.toml is absent so init proceeds past the overwrite check without asking.
    setupDefaultMocks();

    await runInitIn(dir, async () => {
      // Profile files should retain their original content — init must skip writing them.
      const profileContent = await fs.readFile(path.join(profileDir, 'profile.toml'), 'utf-8');
      expect(profileContent).toBe('id = "existing"');
      const poolContent = await fs.readFile(path.join(profileDir, 'resume_pool.md'), 'utf-8');
      expect(poolContent).toBe('# existing');
    });
  });

  // wolf.toml overwrite cancelled: init should bail out without touching anything.
  it('cancels without writing files when user declines to overwrite wolf.toml', async () => {
    const dir = makeTempDir();
    await fs.mkdir(dir, { recursive: true });

    // Pre-create a wolf.toml to trigger the overwrite prompt.
    await fs.writeFile(path.join(dir, 'wolf.toml'), 'defaultProfileId = "old"', 'utf-8');

    // Mock: confirm is called for "Overwrite existing config?" — user says no.
    vi.mocked(confirm).mockResolvedValueOnce(false);

    await runInitIn(dir, async () => {
      // wolf.toml should remain unchanged after the cancelled init.
      const remaining = await fs.readFile(path.join(dir, 'wolf.toml'), 'utf-8');
      expect(remaining).toBe('defaultProfileId = "old"');

      // No profile directory should have been created.
      const profileDirExists = await fs.access(path.join(dir, 'profiles')).then(() => true).catch(() => false);
      expect(profileDirExists).toBe(false);
    });
  });

  // Non-interactive init is the acceptance-test bootstrap path. It must not
  // call any prompt, and it must create schema-valid default files.
  it('creates an empty workspace without prompts when --empty is set', async () => {
    const dir = makeTempDir();
    await fs.mkdir(dir, { recursive: true });
    const originalCwd = process.cwd();
    process.chdir(dir);

    await init({ empty: true, here: true });

    try {
      const raw = await fs.readFile(path.join(dir, 'wolf.toml'), 'utf-8');
      const config = AppConfigSchema.parse(parse(raw));
      expect(config.defaultProfileId).toBe('default');
      expect(config.instance?.mode).toBeUndefined();

      const profileRaw = await fs.readFile(
        path.join(dir, 'profiles', 'default', 'profile.toml'),
        'utf-8',
      );
      const profile = UserProfileSchema.parse(parse(profileRaw));
      expect(profile.id).toBe('default');
      // --empty skeleton leaves required name fields as empty strings; the user
      // must edit them before any name-surfacing command runs.
      expect(profile.legalFirstName).toBe('');
      expect(profile.legalLastName).toBe('');
      expect(profile.email).toBe('');
      expect(profile.targetRoles).toEqual([]);
      expect(profile.targetLocations).toEqual([]);

      const resumePool = await fs.readFile(
        path.join(dir, 'profiles', 'default', 'resume_pool.md'),
        'utf-8',
      );
      expect(resumePool).toBe('');
      await expect(fs.access(path.join(dir, 'data'))).resolves.toBeUndefined();
      expect(input).not.toHaveBeenCalled();
      expect(confirm).not.toHaveBeenCalled();
      expect(select).not.toHaveBeenCalled();
    } finally {
      process.chdir(originalCwd);
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // Dev empty init is the exact path the acceptance orchestrator will run in
  // /tmp/wolf-at-* workspaces. The dev marker makes the workspace self-labeling.
  it('writes instance.mode = dev for --dev --empty workspaces', async () => {
    const dir = makeTempDir();
    process.env.WOLF_BUILD_MODE = 'dev';
    process.env.WOLF_DEV_HOME = dir;

    try {
      await init({ dev: true, empty: true });

      const raw = await fs.readFile(path.join(dir, 'wolf.toml'), 'utf-8');
      const config = AppConfigSchema.parse(parse(raw));
      expect(config.instance?.mode).toBe('dev');
    } finally {
      delete process.env.WOLF_BUILD_MODE;
      delete process.env.WOLF_DEV_HOME;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // A stable build must not be able to create a dev-marked workspace; otherwise
  // a user or agent could confuse the real binary with the local dev build.
  it('rejects --dev when the binary is not a dev build', async () => {
    delete process.env.WOLF_BUILD_MODE;
    await expect(init({ dev: true, empty: true, here: true }))
      .rejects.toThrow('--dev requires a dev build');
  });
});
