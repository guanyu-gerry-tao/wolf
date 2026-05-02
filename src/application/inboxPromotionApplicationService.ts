import type { BatchAiProvider } from '../service/batchService.js';

export interface InboxPromoteOptions {
  limit: number;
  provider: BatchAiProvider;
  shardSize: number;
}

export interface InboxPromoteResult {
  batchId: string | null;
  status: 'empty' | 'queued' | 'completed';
  itemCount: number;
  shardCount: number;
  jobIds?: string[];
}

export interface InboxPromotionApplicationService {
  promoteRawInbox(options: InboxPromoteOptions): Promise<InboxPromoteResult>;
  promoteInboxItem(id: string, options: Omit<InboxPromoteOptions, 'limit'>): Promise<InboxPromoteResult>;
}
