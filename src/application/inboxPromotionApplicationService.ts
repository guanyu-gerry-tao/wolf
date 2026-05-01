import type { BatchAiProvider } from '../service/batchService.js';

export interface InboxPromoteOptions {
  limit: number;
  provider: BatchAiProvider;
  shardSize: number;
}

export interface InboxPromoteResult {
  batchId: string | null;
  status: 'empty' | 'queued';
  itemCount: number;
  shardCount: number;
}

export interface InboxPromotionApplicationService {
  promoteRawInbox(options: InboxPromoteOptions): Promise<InboxPromoteResult>;
}
