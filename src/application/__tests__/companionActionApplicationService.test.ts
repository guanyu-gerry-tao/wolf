import { describe, expect, it, vi } from 'vitest';
import { CompanionActionApplicationServiceImpl } from '../impl/companionActionApplicationServiceImpl.js';
import type { BatchService } from '../../service/batchService.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type { TailorApplicationService } from '../tailorApplicationService.js';

// Companion batch tailor should use the durable provider Batch API, not the
// older sequential quick-tailor loop. The mocked BatchService lets the test
// assert request shape without making a paid network call.
describe('CompanionActionApplicationServiceImpl.batchTailor', () => {
  it('submits selected jobs as one durable AI batch', async () => {
    const submitAiBatch = vi.fn<BatchService['submitAiBatch']>().mockResolvedValue({
      id: 'batch-run-1',
      batchId: 'msgbatch_123',
      provider: 'anthropic',
      type: 'tailor',
      model: 'claude-sonnet-4-6',
      submitted: 2,
    });
    const app = new CompanionActionApplicationServiceImpl(
      {} as TailorApplicationService,
      {
        get: async (id: string) => ({
          id,
          title: id === 'job-1' ? 'Backend Engineer' : 'Platform Engineer',
          companyId: 'company-1',
          url: `https://example.com/${id}`,
        }),
        readJdText: async (id: string) => `JD for ${id}`,
      } as unknown as JobRepository,
      {
        getDefault: async () => ({ name: 'default', md: 'Candidate profile' }),
        getResumePool: async () => 'Resume pool',
      } as unknown as ProfileRepository,
      undefined,
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
      },
      { submitAiBatch } as unknown as BatchService,
    );

    const result = await app.batchTailor({
      jobIds: ['job-1', 'job-2'],
      userPrompt: 'Emphasize backend systems.',
    });

    expect(result).toEqual({ runId: 'batch-run-1', status: 'queued' });
    expect(submitAiBatch).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          customId: 'job-1',
          prompt: expect.stringContaining('JD for job-1'),
        }),
        expect.objectContaining({
          customId: 'job-2',
          prompt: expect.stringContaining('JD for job-2'),
        }),
      ],
      {
        type: 'tailor',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        profileId: 'default',
        maxTokens: 12000,
      },
    );
    expect(submitAiBatch.mock.calls[0][0][0].prompt).toContain('Emphasize backend systems.');
  });
});
