// Global vitest setup. Runs once before any test file.
//
// Two responsibilities:
//   1. Stub WOLF_ANTHROPIC_API_KEY so the API-key guard doesn't fail tailor
//      tests. We set the bare WOLF_* form (not WOLF_DEV_*) — `getEnvValue`
//      falls back to it for both stable and dev builds.
//   2. Stub `playwright.chromium.executablePath` to return the running Node
//      binary so the doctor and tailor entry guards see a real existing
//      file and skip the auto-install path. Tests that need finer control
//      over the launch behaviour mock `playwright` themselves and override
//      this default.

if (!process.env.WOLF_ANTHROPIC_API_KEY) {
  process.env.WOLF_ANTHROPIC_API_KEY = 'test-key-not-used-in-tests';
}

import { vi } from 'vitest';

vi.mock('playwright', async (importOriginal) => {
  // Try to keep any real fields that callers might depend on. The CI sandbox
  // may not have Playwright Chromium installed, so we return process.execPath
  // (which definitely exists) for executablePath. Tests that exercise the
  // launch path override this mock with their own (see renderService.test.ts).
  const real = await importOriginal<Record<string, unknown>>().catch(() => ({}));
  return {
    ...real,
    chromium: {
      executablePath: () => process.execPath,
      launch: vi.fn(),
    },
  };
});
