import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse, stringify } from 'smol-toml';
import { profileGet, profileSet, profileList, profileCreate, profileUse, profileDelete } from '../index.js';
import { saveConfig } from '../../../utils/config.js';
import type { AppConfig, UserProfile } from '../../../types/index.js';

// Minimal config; profileGet/profileSet only care about defaultProfileId.
const CONFIG: AppConfig = {
  defaultProfileId: 'default',
  hunt: { minScore: 0.5, maxResults: 50 },
  tailor: { model: 'anthropic/claude-sonnet-4-6', defaultCoverLetterTone: 'professional' },
  score: { model: 'anthropic/claude-sonnet-4-6' },
  reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
  fill: { model: 'anthropic/claude-haiku-4-5-20251001' },
};

const PROFILE: UserProfile = {
  id: 'default',
  label: 'Default',
  name: 'Alex Rivera',
  email: 'alex@example.com',
  phone: '+1 555 000 0000',
  firstUrl: null,
  secondUrl: null,
  thirdUrl: null,
  immigrationStatus: 'no limit',
  willingToRelocate: 'no',
  targetRoles: ['SWE'],
  targetLocations: ['Remote'],
  scoringNotes: null,
};

let tmpDir: string;
let logSpy: ReturnType<typeof vi.spyOn>;
const originalEnv = { ...process.env };

async function writeProfile(profile: UserProfile): Promise<void> {
  const dir = path.join(tmpDir, 'profiles', profile.id);
  await fs.mkdir(dir, { recursive: true });
  // Preserve the init-time convention of "" for nullable optional fields
  // so the profile round-trips through UserProfileSchema cleanly.
  const serializable = {
    ...profile,
    firstUrl:     profile.firstUrl     ?? '',
    secondUrl:    profile.secondUrl    ?? '',
    thirdUrl:     profile.thirdUrl     ?? '',
    scoringNotes: profile.scoringNotes ?? '',
  };
  await fs.writeFile(
    path.join(dir, 'profile.toml'),
    stringify(serializable as unknown as Record<string, unknown>),
    'utf-8',
  );
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wolf-profile-'));
  process.env.WOLF_HOME = tmpDir;
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  await saveConfig(CONFIG);
  await writeProfile(PROFILE);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('profileGet', () => {
  // Simple string field: the most common lookup.
  it('prints a top-level string field', async () => {
    await profileGet('name');
    expect(logSpy).toHaveBeenCalledWith('Alex Rivera');
  });

  // Arrays print as JSON so the output is unambiguous even when an element
  // itself contains commas.
  it('prints array fields as JSON', async () => {
    await profileGet('targetRoles');
    expect(logSpy).toHaveBeenCalledWith('["SWE"]');
  });

  // Missing keys throw; same contract as configGet.
  it('throws when the key is absent', async () => {
    await expect(profileGet('nope')).rejects.toThrow(/Key not found/);
  });
});

describe('profileSet', () => {
  // String roundtrip: write-then-read-back is the core guarantee.
  it('persists a string field', async () => {
    await profileSet('name', 'Jane Doe');
    const raw = await fs.readFile(
      path.join(tmpDir, 'profiles', 'default', 'profile.toml'),
      'utf-8',
    );
    const written = parse(raw) as { name: string };
    expect(written.name).toBe('Jane Doe');
  });

  // Array fields accept comma-separated CLI input — shell-friendly vs JSON syntax.
  it('splits a comma-separated value into an array when target is an array', async () => {
    await profileSet('targetRoles', 'SWE, Backend, Data');
    const raw = await fs.readFile(
      path.join(tmpDir, 'profiles', 'default', 'profile.toml'),
      'utf-8',
    );
    const written = parse(raw) as { targetRoles: string[] };
    expect(written.targetRoles).toEqual(['SWE', 'Backend', 'Data']);
  });

  // The profile directory name is derived from `id`; allowing edits would
  // orphan the folder and break lookups, so the command refuses up front.
  it('refuses to edit the read-only id field', async () => {
    await expect(profileSet('id', 'new-id')).rejects.toThrow(/read-only/);
  });

  // Email format is validated by Zod via z.string().email(); bad input must bounce.
  it('rejects values that violate the schema', async () => {
    await expect(profileSet('email', 'not-an-email')).rejects.toThrow();
  });
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
    await writeProfile({ ...PROFILE, id: 'gc-persona', label: 'GC' });
    await profileList();
    const lines = logSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(lines.some((l: string) => l.startsWith('*') && l.includes('default'))).toBe(true);
    expect(lines.some((l: string) => l.startsWith(' ') && l.includes('gc-persona'))).toBe(true);
  });
});

describe('profileCreate', () => {
  // Default: --from unset, clones from the default profile. Verifies the new
  // profile.toml lands on disk with the right id.
  it('clones from the default profile when --from is not given', async () => {
    await profileCreate('gc-persona');
    const raw = await fs.readFile(
      path.join(tmpDir, 'profiles', 'gc-persona', 'profile.toml'),
      'utf-8',
    );
    const written = parse(raw) as { id: string };
    expect(written.id).toBe('gc-persona');
  });

  // The clone's `id` must be rewritten to match its new directory; otherwise
  // lookups by directory name would see the source's id and bug out.
  it('rewrites the clone\'s id to match the new directory', async () => {
    await profileCreate('jane', { from: 'default' });
    const janeRaw = await fs.readFile(
      path.join(tmpDir, 'profiles', 'jane', 'profile.toml'),
      'utf-8',
    );
    const jane = parse(janeRaw) as { id: string; name: string };
    expect(jane.id).toBe('jane');
    // Data from source is preserved (name), only id/label change.
    expect(jane.name).toBe(PROFILE.name);
  });

  // Invalid ids would create unusable or unsafe paths; the command rejects
  // before touching the filesystem.
  it('rejects invalid profile ids', async () => {
    await expect(profileCreate('bad id')).rejects.toThrow(/Invalid profile id/);
    await expect(profileCreate('-leading-dash')).rejects.toThrow(/Invalid profile id/);
    await expect(profileCreate('../escape')).rejects.toThrow(/Invalid profile id/);
  });

  // Creating over an existing profile would silently overwrite unless we guard;
  // explicit error lets the user choose (delete first, or pick a new id).
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
  it('updates defaultProfileId in wolf.toml', async () => {
    await writeProfile({ ...PROFILE, id: 'gc-persona', label: 'GC' });
    await profileUse('gc-persona');
    const raw = await fs.readFile(path.join(tmpDir, 'wolf.toml'), 'utf-8');
    const config = parse(raw) as { defaultProfileId: string };
    expect(config.defaultProfileId).toBe('gc-persona');
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
    await writeProfile({ ...PROFILE, id: 'scratch', label: 'scratch' });
    await expect(profileDelete('scratch')).rejects.toThrow(/--yes flag/);
  });

  // Happy path: with --yes, the directory is removed.
  it('removes the profile directory when --yes is passed', async () => {
    await writeProfile({ ...PROFILE, id: 'scratch', label: 'scratch' });
    await profileDelete('scratch', { yes: true });
    const exists = await fs.access(path.join(tmpDir, 'profiles', 'scratch'))
      .then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});
