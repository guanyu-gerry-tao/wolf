export type BackgroundAiBatchType = 'inbox_promote' | 'score' | 'tailor' | 'fill' | 'reach';
export type BackgroundAiBatchStatus =
  | 'queued'
  | 'submitting'
  | 'waiting_ai'
  | 'applying'
  | 'completed'
  | 'partial_failed'
  | 'failed';
export type BackgroundAiBatchShardStatus =
  | 'queued'
  | 'submitted'
  | 'waiting_ai'
  | 'completed'
  | 'failed'
  | 'expired';
export type BackgroundAiBatchItemStatus =
  | 'queued'
  | 'waiting_ai'
  | 'succeeded'
  | 'promoted'
  | 'duplicate'
  | 'failed'
  | 'expired';
export type BackgroundAiBatchSubjectType = 'inbox_item' | 'job';

export interface BackgroundAiBatch {
  id: string;
  type: BackgroundAiBatchType;
  status: BackgroundAiBatchStatus;
  inputJson: string;
  createdAt: string;
  updatedAt: string;
  deadlineAt: string | null;
  error: string | null;
}

export interface BackgroundAiBatchShard {
  id: string;
  backgroundAiBatchId: string;
  provider: string;
  providerBatchId: string | null;
  status: BackgroundAiBatchShardStatus;
  itemCount: number;
  nextPollAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface BackgroundAiBatchItem {
  id: string;
  backgroundAiBatchId: string;
  shardId: string | null;
  subjectType: BackgroundAiBatchSubjectType;
  subjectId: string;
  status: BackgroundAiBatchItemStatus;
  aiInputJson: string;
  debugJson: string | null;
  debugExpiresAt: string | null;
  targetId: string | null;
  error: string | null;
}

export interface BackgroundAiBatchRepository {
  saveBatch(batch: BackgroundAiBatch): Promise<void>;
  getBatch(id: string): Promise<BackgroundAiBatch | null>;
  saveShard(shard: BackgroundAiBatchShard): Promise<void>;
  listShards(batchId: string): Promise<BackgroundAiBatchShard[]>;
  listShardsReadyForPoll(nowIso: string, limit: number): Promise<BackgroundAiBatchShard[]>;
  saveItem(item: BackgroundAiBatchItem): Promise<void>;
  listItems(batchId: string): Promise<BackgroundAiBatchItem[]>;
  updateItemStatus(
    id: string,
    patch: Partial<Pick<BackgroundAiBatchItem, 'status' | 'targetId' | 'error' | 'debugJson' | 'debugExpiresAt'>>,
  ): Promise<void>;
  clearExpiredDebug(nowIso: string): Promise<number>;
}
