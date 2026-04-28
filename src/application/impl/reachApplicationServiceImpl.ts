import type { ReachOptions, ReachResult } from '../../utils/types/index.js';
import type { ReachApplicationService } from '../reachApplicationService.js';

/**
 * M5 stub. Throws `Not implemented` — the real implementation will compose
 * a contact-lookup provider, the Claude email-draft prompt, and `.eml` /
 * `.md` writers. Registered in `appContext` now so M5 only needs to swap
 * this class.
 */
export class ReachApplicationServiceImpl implements ReachApplicationService {
  /** @inheritdoc */
  async reach(_options: ReachOptions): Promise<ReachResult> {
    throw new Error('Not implemented');
  }
}
