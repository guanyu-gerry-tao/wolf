import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parse } from 'smol-toml';
import { configGet, configSet } from '../index.js';
import { saveConfig } from '../../../utils/config.js';
import type { AppConfig } from '../../../utils/types/index.js';

// A complete, schema-valid baseline so tests can focus on the field they care about.
const BASELINE: AppConfig = {
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

beforeEach(async () => {
  // Each test gets a fresh temp workspace; WOLF_HOME makes the new stable
  // workspace resolution hit it instead of the user's real ~/wolf.
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wolf-config-'));
  process.env.WOLF_HOME = tmpDir;
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  await saveConfig(BASELINE);
  // Capture console.log so tests can assert printed output.
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('configGet', () => {
  // Top-level scalar: the simplest case, dot-path with a single segment.
  it('prints a top-level scalar', async () => {
    await configGet('default');
    expect(logSpy).toHaveBeenCalledWith('default');
  });

  // Nested scalar: covers the more common "tailor.model" shape.
  it('prints a nested scalar', async () => {
    await configGet('tailor.model');
    expect(logSpy).toHaveBeenCalledWith('anthropic/claude-sonnet-4-6');
  });

  // Missing keys throw so shell pipelines fail fast instead of silently printing undefined.
  it('throws when the key is absent', async () => {
    await expect(configGet('tailor.nope')).rejects.toThrow(/Key not found/);
  });
});

describe('configSet', () => {
  // Strings pass through unchanged; the assertion confirms the file was rewritten.
  it('persists a string value that roundtrips through load', async () => {
    await configSet('tailor.model', 'anthropic/claude-opus-4-6');
    const raw = await fs.readFile(path.join(tmpDir, 'wolf.toml'), 'utf-8');
    const written = parse(raw) as { tailor: { model: string } };
    expect(written.tailor.model).toBe('anthropic/claude-opus-4-6');
  });

  // Numbers are coerced based on the current value's type (number, here 0.5 → 0.7).
  it('coerces a numeric string when the target is a number', async () => {
    await configSet('hunt.minScore', '0.7');
    const raw = await fs.readFile(path.join(tmpDir, 'wolf.toml'), 'utf-8');
    const written = parse(raw) as { hunt: { minScore: number } };
    expect(written.hunt.minScore).toBe(0.7);
  });

  // Zod invariants: minScore must be 0..1. A value outside that range must be rejected.
  it('rejects values that violate the schema', async () => {
    await expect(configSet('hunt.minScore', '99')).rejects.toThrow();
  });

  // Rolling backups guard against accidental overwrites; wolf.toml.backup1
  // should appear on the first set call.
  it('writes a backup before overwriting', async () => {
    await configSet('tailor.model', 'anthropic/claude-opus-4-6');
    const exists = await fs.access(path.join(tmpDir, 'wolf.toml.backup1'))
      .then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});
