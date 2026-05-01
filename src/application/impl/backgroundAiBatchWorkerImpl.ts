import type { BackgroundAiBatchRepository } from '../../repository/backgroundAiBatchRepository.js';
import type {
  BackgroundAiBatchWorker,
  BackgroundAiBatchWorkerTickResult,
} from '../backgroundAiBatchWorker.js';

export class BackgroundAiBatchWorkerImpl implements BackgroundAiBatchWorker {
  constructor(private readonly backgroundAiBatchRepository: BackgroundAiBatchRepository) {}

  async tick(now: Date = new Date()): Promise<BackgroundAiBatchWorkerTickResult> {
    const nowIso = now.toISOString();
    const clearedDebugCount = await this.backgroundAiBatchRepository.clearExpiredDebug(nowIso);

    // Real provider polling lands behind this query. The next_poll_at gate is
    // already enforced here so a frequent serve tick does not spam AI APIs.
    const dueShards = await this.backgroundAiBatchRepository.listShardsReadyForPoll(nowIso, 25);

    return {
      clearedDebugCount,
      dueShardCount: dueShards.length,
    };
  }
}
