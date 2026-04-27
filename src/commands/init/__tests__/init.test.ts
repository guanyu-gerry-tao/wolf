import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { parse } from 'smol-toml';
import { AppConfigSchema } from '../../../utils/schemas.js';

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
import { init } from '../index.js';

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

  // Happy path: fresh workspace — init writes the four template MD files,
  // a wolf.toml pointing at the default profile dir, and the standard sidecar
  // files (.gitignore, CLAUDE.md, AGENTS.md). No data prompts run.
  it('creates wolf.toml, the three profile MDs, and the attachments dir in a fresh directory', async () => {
    const dir = makeTempDir();
    await fs.mkdir(dir, { recursive: true });

    await runInitIn(dir, async () => {
      // wolf.toml should parse cleanly and point at the conventional default name.
      const raw = await fs.readFile(path.join(dir, 'wolf.toml'), 'utf-8');
      const config = AppConfigSchema.parse(parse(raw));
      expect(config.default).toBe('default');
      expect(config.tailor.model).toBe('anthropic/claude-sonnet-4-6');
      expect(config.fill.model).toBe('anthropic/claude-haiku-4-5-20251001');

      // The three profile MD templates each get written.
      const profileDir = path.join(dir, 'profiles', 'default');
      const profileMd = await fs.readFile(path.join(profileDir, 'profile.md'), 'utf-8');
      expect(profileMd).toContain('# Identity');
      expect(profileMd).toContain('# Job Preferences');
      expect(profileMd).toContain('# Demographics');

      const standardQuestions = await fs.readFile(path.join(profileDir, 'standard_questions.md'), 'utf-8');
      expect(standardQuestions).toContain('# Short Answers');
      expect(standardQuestions).toContain('# Documents');

      const resumePool = await fs.readFile(path.join(profileDir, 'resume_pool.md'), 'utf-8');
      expect(resumePool).toContain('# Resume Pool');

      // attachments/ exists and contains the explanatory README.
      const attachmentsReadme = await fs.readFile(
        path.join(profileDir, 'attachments', 'README.md'), 'utf-8',
      );
      expect(attachmentsReadme).toContain('attachments/');

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

  // Idempotent re-run: existing profile MDs must not be overwritten.
  it('does not overwrite profile MDs on re-run', async () => {
    const dir = makeTempDir();
    await fs.mkdir(dir, { recursive: true });

    // Pre-create profile files with known sentinel content before running init.
    const profileDir = path.join(dir, 'profiles', 'default');
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(path.join(profileDir, 'profile.md'), '# already-edited', 'utf-8');
    await fs.writeFile(path.join(profileDir, 'resume_pool.md'), '# existing', 'utf-8');
    await fs.writeFile(path.join(profileDir, 'standard_questions.md'), '# my answers', 'utf-8');

    await runInitIn(dir, async () => {
      // Profile files should retain their original content — init must skip writing them.
      const profileContent = await fs.readFile(path.join(profileDir, 'profile.md'), 'utf-8');
      expect(profileContent).toBe('# already-edited');
      const poolContent = await fs.readFile(path.join(profileDir, 'resume_pool.md'), 'utf-8');
      expect(poolContent).toBe('# existing');
      const sqContent = await fs.readFile(path.join(profileDir, 'standard_questions.md'), 'utf-8');
      expect(sqContent).toBe('# my answers');
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

  // Non-interactive init is the acceptance-test bootstrap path. It must not
  // call any prompt, and it must produce the same files as the interactive path.
  it('creates a workspace without prompts when --empty is set', async () => {
    const dir = makeTempDir();
    await fs.mkdir(dir, { recursive: true });
    const originalCwd = process.cwd();
    process.chdir(dir);

    await init({ empty: true, here: true });

    try {
      const raw = await fs.readFile(path.join(dir, 'wolf.toml'), 'utf-8');
      const config = AppConfigSchema.parse(parse(raw));
      expect(config.default).toBe('default');
      expect(config.instance?.mode).toBeUndefined();

      // The same template files appear under --empty.
      const profileDir = path.join(dir, 'profiles', 'default');
      const profileMd = await fs.readFile(path.join(profileDir, 'profile.md'), 'utf-8');
      expect(profileMd).toContain('# Identity');

      const standardQuestions = await fs.readFile(path.join(profileDir, 'standard_questions.md'), 'utf-8');
      expect(standardQuestions).toContain('# Short Answers');

      const resumePool = await fs.readFile(path.join(profileDir, 'resume_pool.md'), 'utf-8');
      expect(resumePool).toContain('# Resume Pool');

      await expect(fs.access(path.join(dir, 'data'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(profileDir, 'attachments'))).resolves.toBeUndefined();

      // Crucially: no prompt of any kind in --empty mode.
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
