import { describe, expect, it } from 'vitest';
import { RunStatusApplicationServiceImpl } from '../impl/runStatusApplicationServiceImpl.js';
import type { BackgroundAiBatchRepository } from '../../repository/backgroundAiBatchRepository.js';
import type { BatchItemRepository } from '../../repository/batchItemRepository.js';
import type { BatchRepository } from '../../repository/batchRepository.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { RenderService } from '../../service/renderService.js';

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

  // Provider Batch API runs live in the base `batches` / `batch_items` tables.
  // The same companion polling endpoint should expose them without requiring
  // the old background_ai_batches scaffolding.
  it('maps base AI batch rows into companion run status', async () => {
    const app = new RunStatusApplicationServiceImpl(
      { getBatch: async () => null } as unknown as BackgroundAiBatchRepository,
      undefined,
      {
        get: async (id: string) => ({
          id,
          batchId: 'msgbatch_123',
          type: 'tailor',
          aiProvider: 'anthropic',
          model: 'claude-sonnet-4-6',
          profileId: 'default',
          status: 'pending',
          errorMessage: null,
          submittedAt: '2026-05-01T00:00:00.000Z',
          completedAt: null,
        }),
      } as unknown as BatchRepository,
      {
        listByBatch: async () => [
          {
            id: 'item-1',
            batchId: 'batch-run-1',
            customId: 'job-1',
            status: 'pending',
            resultText: null,
            errorMessage: null,
            consumedAt: null,
            createdAt: '2026-05-01T00:00:00.000Z',
            completedAt: null,
          },
        ],
      } as unknown as BatchItemRepository,
    );

    await expect(app.getRunStatus('batch-run-1')).resolves.toMatchObject({
      runId: 'batch-run-1',
      type: 'tailor',
      status: 'waiting_ai',
      itemCount: 1,
      artifacts: {
        resume: { status: 'not_ready', url: null },
        coverLetter: { status: 'not_ready', url: null },
      },
    });
  });

  // Once the provider batch is complete, successful tailor item JSON should be
  // consumed into real job artifacts. This is the step that makes the side
  // panel's Resume / Cover Letter buttons truthfully become ready.
  it('applies completed base tailor batch items into job artifacts', async () => {
    const writes: Record<string, string | Buffer> = {};
    const consumed: string[] = [];
    const app = new RunStatusApplicationServiceImpl(
      { getBatch: async () => null } as unknown as BackgroundAiBatchRepository,
      undefined,
      {
        get: async (id: string) => ({
          id,
          batchId: 'msgbatch_123',
          type: 'tailor',
          aiProvider: 'anthropic',
          model: 'claude-sonnet-4-6',
          profileId: 'default',
          status: 'completed',
          errorMessage: null,
          submittedAt: '2026-05-01T00:00:00.000Z',
          completedAt: '2026-05-01T00:10:00.000Z',
        }),
      } as unknown as BatchRepository,
      {
        listByBatch: async () => [
          {
            id: 'item-1',
            batchId: 'batch-run-1',
            customId: 'job-1',
            status: 'succeeded',
            resultText: JSON.stringify({
              tailoringBrief: 'brief',
              resumeHtml: '<section>resume</section>',
              coverLetterHtml: '<section>cover</section>',
            }),
            errorMessage: null,
            consumedAt: null,
            createdAt: '2026-05-01T00:00:00.000Z',
            completedAt: '2026-05-01T00:10:00.000Z',
          },
        ],
        markConsumed: async (id: string) => { consumed.push(id); },
      } as unknown as BatchItemRepository,
      undefined,
      {
        getWorkspaceDir: async () => '/tmp/wolf-test/job-1',
        update: async () => undefined,
      } as unknown as JobRepository,
      {
        renderPdf: async () => Buffer.from('resume-pdf'),
        renderCoverLetterPdf: async () => Buffer.from('cover-pdf'),
      } as unknown as RenderService,
      async (filePath, content) => { writes[filePath] = content; },
    );

    await expect(app.getRunStatus('batch-run-1')).resolves.toMatchObject({
      status: 'ready',
      artifacts: {
        resume: { status: 'ready', url: null },
        coverLetter: { status: 'ready', url: null },
      },
    });
    expect(consumed).toEqual(['item-1']);
    expect(writes['/tmp/wolf-test/job-1/src/tailoring-brief.md']).toBe('brief');
    expect(writes['/tmp/wolf-test/job-1/src/resume.html']).toBe('<section>resume</section>');
    expect(writes['/tmp/wolf-test/job-1/cover_letter.pdf']).toEqual(Buffer.from('cover-pdf'));
  });
});
