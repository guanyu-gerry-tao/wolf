import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// We test the functions against a real temp directory, so we need to point
// CONFIG_PATH at our temp dir. Since config.ts derives CONFIG_PATH from
// process.cwd() at module load time, we mock process.cwd() before importing.
import { vi } from 'vitest';

let tmpDir: string;
const originalEnv = { ...process.env };

describe('config utils', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wolf-test-'));
    process.env.WOLF_HOME = tmpDir;
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('saveConfig + loadConfig', () => {
    it('roundtrips a config object through wolf.toml', async () => {
      const { saveConfig, loadConfig } = await import('../config.js');

      const config = {
        schemaVersion: 1,
        default: 'default',
        hunt: { minScore: 0.5, maxResults: 50 },
        tailor: { model: 'anthropic/claude-sonnet-4-6' },
        score: { model: 'anthropic/claude-sonnet-4-6' },
        reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
        fill: { model: 'anthropic/claude-haiku-4-5-20251001' },
        companion: { servePort: 47823, maxStagehandSessions: 3, browserMode: 'wolf_persistent_profile' as const },
      };

      await saveConfig(config);

      const loaded = await loadConfig();
      expect(loaded.default).toBe('default');
      expect(loaded.hunt.minScore).toBe(0.5);
      expect(loaded.tailor.model).toBe('anthropic/claude-sonnet-4-6');
    });

    // Asserts the typed-error contract: a missing wolf.toml yields a
    // `WorkspaceNotInitializedError` whose fields drive the CLI banner +
    // MCP structured response. Catching as `Error` and inspecting `.code`
    // avoids importing the class (and its sibling `instance.ts` deps) in
    // tests that don't need them.
    it('throws WorkspaceNotInitializedError if wolf.toml does not exist', async () => {
      const { loadConfig } = await import('../config.js');
      const { WorkspaceNotInitializedError } = await import('../errors/workspaceNotInitializedError.js');
      await fs.rm(path.join(tmpDir, 'wolf.toml'), { force: true });
      await expect(loadConfig()).rejects.toBeInstanceOf(WorkspaceNotInitializedError);
    });
  });

  describe('backupConfig', () => {
    it('copies wolf.toml to wolf.toml.backup1', async () => {
      const { saveConfig, backupConfig } = await import('../config.js');
      await saveConfig({ schemaVersion: 1, default: '', hunt: { minScore: 0.5, maxResults: 50 }, tailor: { model: 'anthropic/claude-sonnet-4-6' }, score: { model: 'anthropic/claude-sonnet-4-6' }, reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: '', maxEmailsPerDay: 10 }, fill: { model: 'anthropic/claude-haiku-4-5-20251001' }, companion: { servePort: 47823, maxStagehandSessions: 3, browserMode: 'wolf_persistent_profile' as const } });

      await backupConfig();

      const backup = await fs.readFile(path.join(tmpDir, 'wolf.toml.backup1'), 'utf-8');
      expect(backup.length).toBeGreaterThan(0);
    });

    it('rotates backups: backup1 becomes backup2 on second call', async () => {
      const { saveConfig, backupConfig } = await import('../config.js');
      const stub = { schemaVersion: 1, default: '', hunt: { minScore: 0.5, maxResults: 50 }, tailor: { model: 'anthropic/claude-sonnet-4-6' }, score: { model: 'anthropic/claude-sonnet-4-6' }, reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: '', maxEmailsPerDay: 10 }, fill: { model: 'anthropic/claude-haiku-4-5-20251001' }, companion: { servePort: 47823, maxStagehandSessions: 3, browserMode: 'wolf_persistent_profile' as const } };

      await saveConfig(stub);
      await backupConfig(); // creates backup1

      await saveConfig(stub);
      await backupConfig(); // backup1 → backup2, new backup1

      const b1 = await fs.access(path.join(tmpDir, 'wolf.toml.backup1')).then(() => true).catch(() => false);
      const b2 = await fs.access(path.join(tmpDir, 'wolf.toml.backup2')).then(() => true).catch(() => false);
      expect(b1).toBe(true);
      expect(b2).toBe(true);
    });

    it('keeps at most 5 backups', async () => {
      const { saveConfig, backupConfig } = await import('../config.js');
      const stub = { schemaVersion: 1, default: '', hunt: { minScore: 0.5, maxResults: 50 }, tailor: { model: 'anthropic/claude-sonnet-4-6' }, score: { model: 'anthropic/claude-sonnet-4-6' }, reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: '', maxEmailsPerDay: 10 }, fill: { model: 'anthropic/claude-haiku-4-5-20251001' }, companion: { servePort: 47823, maxStagehandSessions: 3, browserMode: 'wolf_persistent_profile' as const } };

      for (let i = 0; i < 6; i++) {
        await saveConfig(stub);
        await backupConfig();
      }

      const b5 = await fs.access(path.join(tmpDir, 'wolf.toml.backup5')).then(() => true).catch(() => false);
      const b6 = await fs.access(path.join(tmpDir, 'wolf.toml.backup6')).then(() => true).catch(() => false);
      expect(b5).toBe(true);
      expect(b6).toBe(false);
    });

    it('does not throw if wolf.toml does not exist yet', async () => {
      const { backupConfig } = await import('../config.js');
      await expect(backupConfig()).resolves.not.toThrow();
    });
  });
});
