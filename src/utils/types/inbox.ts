import type { InboxItemStatus } from '../../repository/inboxRepository.js';

export interface ManualPageInboxCapture {
  kind?: 'manual_page';
  source?: 'wolf_companion';
  title?: string;
  url: string;
  html: string;
  capturedAt: string;
}

export interface HuntRunInboxCapture {
  kind?: 'hunt_result';
  provider: string;
  receivedAt: string;
  results: unknown[];
}

export interface InboxSaveResult {
  inboxId: string;
  status: InboxItemStatus;
}
