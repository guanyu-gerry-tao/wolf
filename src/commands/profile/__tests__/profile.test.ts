import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse, stringify } from 'smol-toml';
import { profileGet, profileSet } from '../index.js';
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
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  await saveConfig(CONFIG);
  await writeProfile(PROFILE);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
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
