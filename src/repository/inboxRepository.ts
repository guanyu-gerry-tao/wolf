import type {
  HuntRunInboxCapture,
  InboxSaveResult,
  ManualPageInboxCapture,
} from '../utils/types/inbox.js';

export type InboxItemKind = 'manual_page' | 'hunt_result';
export type InboxItemStatus = 'raw' | 'queued' | 'processing' | 'promoted' | 'duplicate' | 'failed';

export interface InboxItem {
  id: string;
  kind: InboxItemKind;
  source: string;
  url: string | null;
  title: string | null;
  rawJson: string;
  rawSha256: string;
  status: InboxItemStatus;
  jobId: string | null;
  receivedAt: string;
  updatedAt: string;
  error: string | null;
}

export interface InboxRepository {
  saveManualPage(input: ManualPageInboxCapture): Promise<InboxSaveResult>;
  saveHuntRun(input: HuntRunInboxCapture): Promise<InboxSaveResult>;
  insert(item: InboxItem): Promise<void>;
  findByRawSha256(rawSha256: string): Promise<InboxItem | null>;
  findManualPageByUrl(url: string): Promise<InboxItem | null>;
  listByStatus(status: InboxItemStatus, limit: number): Promise<InboxItem[]>;
  updateStatus(id: string, patch: Partial<Pick<InboxItem, 'status' | 'jobId' | 'error'>>): Promise<void>;
}
