import { describe, expect, it } from 'vitest';
import { StagehandFillServiceImpl } from '../impl/stagehandFillServiceImpl.js';

describe('StagehandFillServiceImpl', () => {
  // Stagehand is installed and has a service boundary, but the first PR keeps
  // real observe/cache/replay behind an explicit TODO so autofill can safely
  // fall back to the conservative Playwright path.
  it('reports fallback until Stagehand LOCAL is wired to the wolf browser session', async () => {
    const service = new StagehandFillServiceImpl();

    const result = await service.fill({
      page: {} as never,
      jobId: 'job-1',
      userPrompt: 'Use my profile answers.',
      profileMarkdown: '# profile',
      fillValues: { email: 'user@example.com' },
    });

    expect(result).toEqual({
      mode: 'fallback_required',
      filledFields: 0,
      warnings: [
        'Stagehand LOCAL observe/cache/replay is installed but not wired yet; falling back to safe Playwright field filling.',
      ],
    });
  });
});
