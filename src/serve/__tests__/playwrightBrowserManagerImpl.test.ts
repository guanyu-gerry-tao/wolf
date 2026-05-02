import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlaywrightBrowserManagerImpl } from '../impl/playwrightBrowserManagerImpl.js';

const mocks = vi.hoisted(() => ({
  launchPersistentContext: vi.fn(),
}));

// Mock Playwright so the serve browser manager test can assert launch options
// without opening a real Chrome window on the developer machine.
vi.mock('playwright', () => ({
  chromium: {
    launchPersistentContext: mocks.launchPersistentContext,
  },
}));

describe('PlaywrightBrowserManagerImpl', () => {
  beforeEach(() => {
    mocks.launchPersistentContext.mockReset();
    mocks.launchPersistentContext.mockResolvedValue(fakeContext());
  });

  // The wolf browser should use a normal Google Chrome profile, not Chrome for
  // Testing, so users can install wolf companion and password-manager
  // extensions once and keep them across serve restarts.
  it('launches Google Chrome with user extensions enabled for the wolf profile', async () => {
    const manager = new PlaywrightBrowserManagerImpl('/tmp/wolf-test/browser-profile');

    await manager.open();

    expect(mocks.launchPersistentContext).toHaveBeenCalledWith('/tmp/wolf-test/browser-profile', {
      channel: 'chrome',
      headless: false,
      ignoreDefaultArgs: ['--disable-extensions'],
    });
  });

  // Startup URL support is intentionally dormant in AppContext for now. When
  // onboarding is ready, wiring this to a wiki URL will open that page without
  // changing the browser lifecycle.
  it('can open an optional startup URL after Chrome is ready', async () => {
    const context = fakeContext();
    mocks.launchPersistentContext.mockResolvedValue(context);
    const manager = new PlaywrightBrowserManagerImpl(
      '/tmp/wolf-test/browser-profile',
      'https://example.com/wiki',
    );

    await manager.open();

    expect(context.page.goto).toHaveBeenCalledWith('https://example.com/wiki');
  });

  // A missing Google Chrome install should be explained in user-facing terms,
  // rather than leaking only the low-level Playwright launch error.
  it('explains that Google Chrome is required when launch fails', async () => {
    mocks.launchPersistentContext.mockRejectedValue(new Error('Executable does not exist'));
    const manager = new PlaywrightBrowserManagerImpl('/tmp/wolf-test/browser-profile');

    await expect(manager.open()).rejects.toThrow('Install Google Chrome');
  });
});

function fakeContext() {
  const page = {
    bringToFront: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
    isClosed: vi.fn().mockReturnValue(false),
    once: vi.fn(),
    title: vi.fn().mockResolvedValue('Wolf Browser'),
    url: vi.fn().mockReturnValue('about:blank'),
  };
  return {
    page,
    pages: vi.fn().mockReturnValue([page]),
    newPage: vi.fn().mockResolvedValue(page),
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
}
