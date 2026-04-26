import { afterEach, describe, expect, it, vi } from 'vitest';

describe('MCP tool instance behavior', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  // Stable MCP keeps the public wolf_* tool namespace.
  it('uses wolf_* tool names in stable builds', async () => {
    delete process.env.WOLF_BUILD_MODE;
    const { mcpToolName } = await import('../tools.js');

    expect(mcpToolName('hunt')).toBe('wolf_hunt');
    expect(mcpToolName('tailor')).toBe('wolf_tailor');
  });

  // Dev MCP uses wolfdev_* so Claude Desktop can enable both servers without
  // tool-name collisions.
  it('uses wolfdev_* tool names in dev builds', async () => {
    process.env.WOLF_BUILD_MODE = 'dev';
    const { mcpToolName } = await import('../tools.js');

    expect(mcpToolName('hunt')).toBe('wolfdev_hunt');
    expect(mcpToolName('tailor')).toBe('wolfdev_tailor');
  });

  // Dev responses include structured evidence that they came from a dev build.
  it('adds a warning field to dev MCP JSON payloads', async () => {
    process.env.WOLF_BUILD_MODE = 'dev';
    const { withMcpWarning } = await import('../tools.js');

    expect(withMcpWarning({ ok: true })).toEqual({
      ok: true,
      _warning: 'DEVELOPING VERSION - not for production',
    });
  });
});
