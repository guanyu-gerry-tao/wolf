import type {
  HuntRunInboxCapture,
  InboxSaveResult,
  ManualPageInboxCapture,
} from '../utils/types/inbox.js';
import type { InboxItem } from '../repository/inboxRepository.js';

export interface InboxApplicationService {
  saveCurrentPage(input: ManualPageInboxCapture): Promise<InboxSaveResult>;
  saveHuntRun(input: HuntRunInboxCapture): Promise<InboxSaveResult>;
  findDuplicateManualPage(url: string): Promise<InboxItem | null>;
}
