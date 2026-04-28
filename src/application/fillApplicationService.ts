import type { FillOptions, FillResult } from '../utils/types/index.js';

export interface FillApplicationService {
  // M4: Playwright-driven form fill + screenshot + status update.
  fill(options: FillOptions): Promise<FillResult>;
}
