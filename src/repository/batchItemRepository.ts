/** Lifecycle state for one request inside an AI batch. */
export type BatchItemStatus = 'pending' | 'succeeded' | 'errored' | 'canceled' | 'expired';

/** One persisted request/result row belonging to a parent batch. */
export interface BatchItem {
  id: string;
  batchId: string;
  customId: string;
  status: BatchItemStatus;
  resultText: string | null;
  errorMessage: string | null;
  consumedAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Repository for durable per-request AI batch results. */
export interface BatchItemRepository {
  /** Inserts all item rows for a submitted batch. */
  saveMany(items: BatchItem[]): Promise<void>;
  /** Returns every item belonging to one batch. */
  listByBatch(batchId: string): Promise<BatchItem[]>;
  /** Stores normalized provider output for one successful item. */
  markSucceeded(batchId: string, customId: string, resultText: string, completedAt: string): Promise<void>;
  /** Stores provider failure/cancel/expiry information for one item. */
  markFailed(
    batchId: string,
    customId: string,
    status: Exclude<BatchItemStatus, 'pending' | 'succeeded'>,
    errorMessage: string,
    completedAt: string,
  ): Promise<void>;
  /** Marks an item consumed after a business service has handled it. */
  markConsumed(id: string, consumedAt: string): Promise<void>;
}
