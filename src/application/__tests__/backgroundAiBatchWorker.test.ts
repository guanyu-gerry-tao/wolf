import { describe, expect, it, vi } from 'vitest';
import { BackgroundAiBatchWorkerImpl } from '../impl/backgroundAiBatchWorkerImpl.js';
import type { BackgroundAiBatchRepository } from '../../repository/backgroundAiBatchRepository.js';

// The serve worker may tick often, but provider polling must remain gated by
// repository state such as next_poll_at.
describe('BackgroundAiBatchWorkerImpl', () => {
  // A tick performs cheap local maintenance and asks only for shards that are
  // due. The provider integration will be added behind this seam later.
  it('clears expired debug and counts due shards', async () => {
    const repo = {
      clearExpiredDebug: vi.fn(async () => 2),
      listShardsReadyForPoll: vi.fn(async () => [
        {
          id: 'shard-1',
          backgroundAiBatchId: 'batch-1',
          provider: 'anthropic',
          providerBatchId: 'provider-1',
          status: 'waiting_ai',
          itemCount: 20,
          nextPollAt: null,
          submittedAt: null,
          completedAt: null,
          error: null,
        },
      ]),
    } as unknown as BackgroundAiBatchRepository;
    const worker = new BackgroundAiBatchWorkerImpl(repo);

    const result = await worker.tick(new Date('2026-05-01T00:01:00.000Z'));

    expect(repo.clearExpiredDebug).toHaveBeenCalledWith('2026-05-01T00:01:00.000Z');
    expect(repo.listShardsReadyForPoll).toHaveBeenCalledWith('2026-05-01T00:01:00.000Z', 25);
    expect(result).toEqual({ clearedDebugCount: 2, dueShardCount: 1 });
  });
});
