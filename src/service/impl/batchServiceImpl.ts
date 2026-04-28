import type { BatchService, BatchSubmitOptions } from '../batchService.js';
import type { BatchRepository } from '../../repository/batchRepository.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { Job } from '../../utils/types/index.js';

/**
 * Default `BatchService` impl. Stub until M3+: real implementation lives on
 * `dev/v0.3:src/utils/batch.ts` and will be ported here once the Batch API
 * scoring path lands. Persists batch metadata via `BatchRepository`; reads
 * Job rows back through `JobRepository` to attach scoring results.
 */
export class BatchServiceImpl implements BatchService {
  constructor(
    private readonly batchRepo: BatchRepository,
    private readonly jobRepo: JobRepository,
  ) {}

  /** @inheritdoc */
  async submit(_jobs: Job[], _options: BatchSubmitOptions): Promise<string> {
    throw new Error('Not implemented (M3+) — see dev/v0.3:src/utils/batch.ts for reference');
  }

  /** @inheritdoc */
  async pollAll(): Promise<void> {
    throw new Error('Not implemented (M3+) — see dev/v0.3:src/utils/batch.ts for reference');
  }
}
