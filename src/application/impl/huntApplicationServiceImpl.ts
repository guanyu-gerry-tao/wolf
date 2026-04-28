import type { HuntOptions, HuntResult } from '../../utils/types/index.js';
import type { HuntApplicationService } from '../huntApplicationService.js';

/**
 * M2 stub. Throws `Not implemented` — the real implementation will compose
 * the `JobProvider` registry, dedup logic, and `JobRepository.saveMany`.
 * Registered in `appContext` now so M2 only needs to swap this class.
 */
export class HuntApplicationServiceImpl implements HuntApplicationService {
  /** @inheritdoc */
  async hunt(_options: HuntOptions): Promise<HuntResult> {
    throw new Error('Not implemented');
  }
}
