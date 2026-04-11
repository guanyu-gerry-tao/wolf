import type { BatchService, BatchSubmitOptions } from '../batch.js';
import type { BatchRepository } from '../../repository/batch.js';
import type { JobRepository } from '../../repository/job.js';
import type { Job } from '../../types/index.js';

export class BatchServiceImpl implements BatchService {
  constructor(
    private readonly batchRepo: BatchRepository,
    private readonly jobRepo: JobRepository,
  ) {}

  async submit(_jobs: Job[], _options: BatchSubmitOptions): Promise<string> {
    throw new Error('Not implemented (M3+) — see dev/v0.3:src/utils/batch.ts for reference');
  }

  async pollAll(): Promise<void> {
    throw new Error('Not implemented (M3+) — see dev/v0.3:src/utils/batch.ts for reference');
  }
}
