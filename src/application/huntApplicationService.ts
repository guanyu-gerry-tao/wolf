import type { HuntOptions, HuntResult } from '../utils/types/index.js';

export interface HuntApplicationService {
  // M2: orchestrates provider fan-out, dedup, and persistence to jobRepository.
  hunt(options: HuntOptions): Promise<HuntResult>;
}
