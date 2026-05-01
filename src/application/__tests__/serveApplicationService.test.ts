import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServeApplicationServiceImpl } from '../impl/serveApplicationServiceImpl.js';
import type { HttpServer } from '../../transport/http/httpServer.js';

describe('ServeApplicationServiceImpl', () => {
  afterEach(() => vi.restoreAllMocks());

  // The serve command occupies the terminal while it runs, so startup output
  // must make the browser-extension port obvious before the process blocks.
  it('prints a wolf companion setup banner with the selected port', async () => {
    const httpServer = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      address: vi.fn(),
    } as unknown as HttpServer;
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const app = new ServeApplicationServiceImpl(httpServer);

    await app.run({ port: 49152, browser: false, stopAfterStart: true });

    const output = write.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('wolf serve listening on http://127.0.0.1:49152');
    expect(output).toContain('='.repeat(64));
    expect(output).toContain('  USER PLEASE READ');
    expect(output).toContain('  WOLF COMPANION SETUP');
    expect(output).toContain('    Port:  49152');
    expect(output).not.toContain('URL:');
    expect(output).toContain('Copy this port into the wolf companion browser extension:');
    expect(output).toContain('Keep this terminal open while using the extension.');
    expect(output).toContain('Stop:  Press Ctrl-C in this terminal.');
  });
});
