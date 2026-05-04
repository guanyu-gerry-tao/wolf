import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SERVE_PORT, serve } from '../serve.js';

describe('serve command wrapper', () => {
  // CLI remains a thin wrapper: it parses the port and delegates to the
  // application service instead of growing daemon lifecycle logic inline.
  it('starts the serve application service on the default port', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const ctx = { serveApp: { run } } as never;

    await serve({ stopAfterStart: true }, ctx);

    expect(run).toHaveBeenCalledWith({ port: DEFAULT_SERVE_PORT, browser: true, stopAfterStart: true });
  });

  // The side panel lets the user type a port, so the CLI needs the same
  // explicit override for manual local runs.
  it('passes an explicit port through', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const ctx = { serveApp: { run } } as never;

    await serve({ port: 49152, stopAfterStart: true }, ctx);

    expect(run).toHaveBeenCalledWith({ port: 49152, browser: true, stopAfterStart: true });
  });

  // Browser launch is the default UX for `wolf serve`; --no-browser disables
  // it for CI, headless servers, and protocol-only development.
  it('can disable the browser launch stub', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const ctx = { serveApp: { run } } as never;

    await serve({ browser: false, stopAfterStart: true }, ctx);

    expect(run).toHaveBeenCalledWith({ port: DEFAULT_SERVE_PORT, browser: false, stopAfterStart: true });
  });
});
