import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('instance helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  // Stable builds are the user-facing binary. They default to ~/wolf unless
  // WOLF_HOME explicitly redirects the workspace.
  it('resolves stable workspace from WOLF_HOME or ~/wolf', async () => {
    delete process.env.WOLF_BUILD_MODE;
    delete process.env.WOLF_HOME;
    const stable = await import('../instance.js');

    expect(stable.getBuildMode()).toBe('stable');
    expect(stable.resolveWorkspaceDir()).toBe(path.join(os.homedir(), 'wolf'));

    process.env.WOLF_HOME = '/tmp/wolf-at-stable';
    expect(stable.resolveWorkspaceDir()).toBe('/tmp/wolf-at-stable');
  });

  // Dev builds are what acceptance agents execute. WOLF_DEV_HOME must be able
  // to redirect every command into /tmp/wolf-at-*.
  it('resolves dev workspace from WOLF_DEV_HOME or ~/wolf-dev', async () => {
    process.env.WOLF_BUILD_MODE = 'dev';
    delete process.env.WOLF_DEV_HOME;
    const dev = await import('../instance.js');

    expect(dev.getBuildMode()).toBe('dev');
    expect(dev.resolveWorkspaceDir()).toBe(path.join(os.homedir(), 'wolf-dev'));

    process.env.WOLF_DEV_HOME = '/tmp/wolf-at-T02';
    expect(dev.resolveWorkspaceDir()).toBe('/tmp/wolf-at-T02');
  });

  // --here is the explicit developer escape hatch that keeps old cwd-scoped
  // tests and manual experiments possible without changing global defaults.
  it('resolves --here workspaces to cwd', async () => {
    process.env.WOLF_BUILD_MODE = 'dev';
    const cwd = '/tmp/wolf-at-here';
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    const dev = await import('../instance.js');

    expect(dev.resolveWorkspaceDir({ here: true })).toBe(cwd);
  });

  // Dev env vars shadow stable env vars, while stable builds only read WOLF_*.
  it('prefers WOLF_DEV keys only in dev mode', async () => {
    process.env.WOLF_ANTHROPIC_API_KEY = 'stable-key';
    process.env.WOLF_DEV_ANTHROPIC_API_KEY = 'dev-key';

    delete process.env.WOLF_BUILD_MODE;
    const stable = await import('../instance.js');
    expect(stable.getEnvValue('ANTHROPIC_API_KEY')).toBe('stable-key');

    vi.resetModules();
    process.env.WOLF_BUILD_MODE = 'dev';
    const dev = await import('../instance.js');
    expect(dev.getEnvValue('ANTHROPIC_API_KEY')).toBe('dev-key');
  });
});
