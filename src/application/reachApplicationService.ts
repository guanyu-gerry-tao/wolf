import type { ReachOptions, ReachResult } from '../utils/types/index.js';

export interface ReachApplicationService {
  // M5: contact lookup + email draft (.eml + .md). wolf does NOT send.
  reach(options: ReachOptions): Promise<ReachResult>;
}
