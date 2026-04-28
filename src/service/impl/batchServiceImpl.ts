import type { BatchService, BatchSubmitOptions } from '../batchService.js';
import type { BatchRepository } from '../../repository/batchRepository.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { Job } from '../../utils/types/index.js';

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
