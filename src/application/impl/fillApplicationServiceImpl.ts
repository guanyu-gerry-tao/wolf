import type { FillOptions, FillResult } from '../../utils/types/index.js';
import type { FillApplicationService } from '../fillApplicationService.js';

/**
 * M4 stub. Throws `Not implemented` — the real implementation will compose
 * `JobRepository`, `ProfileRepository`, and `FillService` into the form-fill
 * pipeline. Registered in `appContext` now so M4 only needs to swap this
 * class without re-wiring.
 */
export class FillApplicationServiceImpl implements FillApplicationService {
  /** @inheritdoc */
  async fill(_options: FillOptions): Promise<FillResult> {
    throw new Error('Not implemented');
  }
}
