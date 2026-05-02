import type { BatchAiCallOptions, BatchAiCallRequest } from '../../batchService.js';
import type { BatchItemStatus } from '../../../repository/batchItemRepository.js';

/** Provider status reduced to the states the base batch runtime needs. */
export type ProviderBatchStatus = 'pending' | 'ended';

/** Provider item result normalized before persistence. */
export interface ProviderBatchItemResult {
  customId: string;
  status: Exclude<BatchItemStatus, 'pending'>;
  resultText: string | null;
  errorMessage: string | null;
}

/** Provider-specific adapter hidden behind BatchServiceImpl. */
export interface BatchProviderAdapter {
  submit(requests: BatchAiCallRequest[], options: BatchAiCallOptions): Promise<string>;
  retrieve(providerBatchId: string): Promise<ProviderBatchStatus>;
  results(providerBatchId: string): Promise<ProviderBatchItemResult[]>;
}
