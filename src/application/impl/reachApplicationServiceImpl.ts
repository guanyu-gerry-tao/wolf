import type { ReachOptions, ReachResult } from '../../utils/types/index.js';
import type { ReachApplicationService } from '../reachApplicationService.js';

export class ReachApplicationServiceImpl implements ReachApplicationService {
  async reach(_options: ReachOptions): Promise<ReachResult> {
    throw new Error('Not implemented');
  }
}
