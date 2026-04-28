import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'smol-toml';
import { profileList, profileCreate, profileUse, profileDelete } from '../index.js';
import { saveConfig } from '../../../utils/config.js';
import type { AppConfig } from '../../../utils/types/index.js';

// Minimal config — `default` points at the conventional initial profile dir.
const CONFIG: AppConfig = {
  default: 'default',
  hunt: { minScore: 0.5, maxResults: 50 },
  tailor: { model: 'anthropic/claude-sonnet-4-6', defaultCoverLetterTone: 'professional' },
  score: { model: 'anthropic/claude-sonnet-4-6' },
  reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
  fill: { model: 'anthropic/claude-haiku-4-5-20251001' },
};

let tmpDir: string;
let logSpy: ReturnType<typeof vi.spyOn>;
const originalEnv = { ...process.env };

// Helper: lay down a fresh profile directory at profiles/<name>/ with the four
// MD files and an attachments dir, mimicking what `wolf init` would create.
// Tests can override the file contents via `overrides`.
async function writeProfileDir(
  name: string,
  overrides: Partial<{ profileMd: string; resumePool: string; standardQuestions: string }> = {},
): Promise<void> {
  const dir = path.join(tmpDir, 'profiles', name);
  await fs.mkdir(path.join(dir, 'attachments'), { recursive: true });
  await fs.writeFile(path.join(dir, 'profile.md'), overrides.profileMd ?? `# ${name}\n`, 'utf-8');
  await fs.writeFile(path.join(dir, 'resume_pool.md'), overrides.resumePool ?? '# Resume Pool\n', 'utf-8');
  await fs.writeFile(path.join(dir, 'standard_questions.md'), overrides.standardQuestions ?? '# Standard Questions\n', 'utf-8');
  await fs.writeFile(path.join(dir, 'attachments', 'README.md'), '# attachments\n', 'utf-8');
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wolf-profile-'));
  process.env.WOLF_HOME = tmpDir;
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  await saveConfig(CONFIG);
  await writeProfileDir('default');
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('profileList', () => {
  // Default profile must be prefixed with * so users can see at a glance
  // which one wolf will use when no -p is passed.
  it('marks the default profile with an asterisk', async () => {
    await profileList();
    const lines = logSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const defaultLine = lines.find((l: string) => l.includes('default'));
    expect(defaultLine).toMatch(/^\*/);
  });

  // When a second profile exists, both are listed but only the default is marked.
  it('lists multiple profiles, marking only the default', async () => {
    // Create a second profile alongside the existing `default`.
    await writeProfileDir('gc-persona');
    await profileList();
    const lines = logSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(lines.some((l: string) => l.startsWith('*') && l.includes('default'))).toBe(true);
    expect(lines.some((l: string) => l.startsWith(' ') && l.includes('gc-persona'))).toBe(true);
  });
});

describe('profileCreate', () => {
  // Default: --from unset, clones from the default profile. Verifies the new
  // profile directory and its MD files all land on disk.
  it('clones from the default profile when --from is not given', async () => {
    await profileCreate('gc-persona');
    const cloned = path.join(tmpDir, 'profiles', 'gc-persona');
    for (const file of ['profile.md', 'resume_pool.md', 'standard_questions.md']) {
      const exists = await fs.access(path.join(cloned, file)).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
    // attachments dir + README come along too.
    const att = await fs.access(path.join(cloned, 'attachments', 'README.md')).then(() => true).catch(() => false);
    expect(att).toBe(true);
  });

  // Source MD content is preserved verbatim — clone is a deep copy of the
  // four files, no rewriting.
  it('preserves source MD content in the clone', async () => {
    // Customize source content so we can detect the copy.
    await writeProfileDir('default', { profileMd: '# default\n\n## marker\nclone-source\n' });
    await profileCreate('jane', { from: 'default' });
    const janeProfile = await fs.readFile(
      path.join(tmpDir, 'profiles', 'jane', 'profile.md'), 'utf-8',
    );
    expect(janeProfile).toContain('clone-source');
  });

  // Invalid names would create unusable or unsafe paths; the command rejects
  // before touching the filesystem.
  it('rejects invalid profile names', async () => {
    await expect(profileCreate('bad name')).rejects.toThrow(/Invalid profile name/);
    await expect(profileCreate('-leading-dash')).rejects.toThrow(/Invalid profile name/);
    await expect(profileCreate('../escape')).rejects.toThrow(/Invalid profile name/);
  });

  // Creating over an existing profile would silently overwrite unless we guard;
  // explicit error lets the user choose (delete first, or pick a new name).
  it('refuses to overwrite an existing profile', async () => {
    await expect(profileCreate('default')).rejects.toThrow(/already exists/);
  });

  // Missing source profile should fail loudly, not create an empty profile directory.
  it('fails when the source profile does not exist', async () => {
    await expect(profileCreate('x', { from: 'nonexistent' })).rejects.toThrow(/not found/);
  });
});

describe('profileUse', () => {
  // Happy path: switching the default profile updates wolf.toml.
  it('updates `default` in wolf.toml', async () => {
    await writeProfileDir('gc-persona');
    await profileUse('gc-persona');
    const raw = await fs.readFile(path.join(tmpDir, 'wolf.toml'), 'utf-8');
    const config = parse(raw) as { default: string };
    expect(config.default).toBe('gc-persona');
  });

  // Pointing the default at a nonexistent profile would cause every subsequent
  // command to fail cryptically; reject up front.
  it('rejects non-existent profiles', async () => {
    await expect(profileUse('ghost')).rejects.toThrow(/not found/);
  });
});

describe('profileDelete', () => {
  // Deleting the default would leave wolf.toml pointing at a missing folder;
  // force the user to switch first.
  it('refuses to delete the default profile', async () => {
    await expect(profileDelete('default', { yes: true })).rejects.toThrow(/default profile/);
  });

  // --yes is a tiny speed-bump against accidents (e.g. shell history, scripted
  // runs) that catches typos before they remove user data.
  it('requires --yes', async () => {
    await writeProfileDir('scratch');
    await expect(profileDelete('scratch')).rejects.toThrow(/--yes flag/);
  });

  // Happy path: with --yes, the directory is removed.
  it('removes the profile directory when --yes is passed', async () => {
    await writeProfileDir('scratch');
    await profileDelete('scratch', { yes: true });
    const exists = await fs.access(path.join(tmpDir, 'profiles', 'scratch'))
      .then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});
