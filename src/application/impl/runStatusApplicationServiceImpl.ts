import type { BackgroundAiBatchStatus } from '../../repository/backgroundAiBatchRepository.js';
import type { BackgroundAiBatchRepository } from '../../repository/backgroundAiBatchRepository.js';
import type {
  CompanionRunStatus,
  RunStatusApplicationService,
  RunStatusResult,
} from '../runStatusApplicationService.js';

export class RunStatusApplicationServiceImpl implements RunStatusApplicationService {
  constructor(private readonly backgroundAiBatchRepository: BackgroundAiBatchRepository) {}

  /** @inheritdoc */
  async getRunStatus(runId: string): Promise<RunStatusResult> {
    const batch = await this.backgroundAiBatchRepository.getBatch(runId);
    if (!batch) {
      return {
        runId,
        status: 'todo',
        error: 'Run status is not tracked yet.',
      };
    }

    const items = await this.backgroundAiBatchRepository.listItems(runId);
    return {
      runId,
      type: batch.type,
      status: mapBackgroundBatchStatus(batch.status),
      itemCount: items.length,
      error: batch.error,
      artifacts: batch.type === 'tailor'
        ? {
            resume: { status: 'not_ready', url: null },
            coverLetter: { status: 'not_ready', url: null },
          }
        : undefined,
    };
  }
}

function mapBackgroundBatchStatus(status: BackgroundAiBatchStatus): CompanionRunStatus {
  if (status === 'queued') return 'queued';
  if (status === 'waiting_ai') return 'waiting_ai';
  if (status === 'completed') return 'ready';
  if (status === 'failed' || status === 'partial_failed') return 'failed';
  return 'running';
}
