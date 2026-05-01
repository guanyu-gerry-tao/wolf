import { describe, expect, it } from 'vitest';
import { RunStatusApplicationServiceImpl } from '../impl/runStatusApplicationServiceImpl.js';
import type { BackgroundAiBatchRepository } from '../../repository/backgroundAiBatchRepository.js';

// Run status is the companion-facing view over durable background AI work.
describe('RunStatusApplicationServiceImpl', () => {
  // The companion polls one run endpoint for all background AI flows. This
  // test proves durable background batch rows are exposed as UI-friendly states.
  it('maps background AI batch state into companion run status', async () => {
    const app = new RunStatusApplicationServiceImpl({
      getBatch: async (id: string) => ({
        id,
        type: 'tailor',
        status: 'waiting_ai',
        inputJson: '{}',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        deadlineAt: null,
        error: null,
      }),
      listItems: async () => [
        {
          id: 'item-1',
          backgroundAiBatchId: 'run-1',
          shardId: null,
          subjectType: 'job',
          subjectId: 'job-1',
          status: 'waiting_ai',
          aiInputJson: '{}',
          debugJson: null,
          debugExpiresAt: null,
          targetId: null,
          error: null,
        },
      ],
    } as unknown as BackgroundAiBatchRepository);

    await expect(app.getRunStatus('run-1')).resolves.toMatchObject({
      runId: 'run-1',
      type: 'tailor',
      status: 'waiting_ai',
      itemCount: 1,
      artifacts: {
        resume: { status: 'not_ready', url: null },
        coverLetter: { status: 'not_ready', url: null },
      },
    });
  });

  // Unknown run IDs should stay machine-readable instead of throwing, so the
  // side panel can show a clear Activity message and stop polling.
  it('returns todo for unknown run ids', async () => {
    const app = new RunStatusApplicationServiceImpl({
      getBatch: async () => null,
    } as unknown as BackgroundAiBatchRepository);

    await expect(app.getRunStatus('missing-run')).resolves.toMatchObject({
      runId: 'missing-run',
      status: 'todo',
      error: 'Run status is not tracked yet.',
    });
  });
});
