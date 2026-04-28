import type { ScoreOptions, ScoreResult } from '../../utils/types/index.js';
import type { ScoreApplicationService } from '../scoreApplicationService.js';

/**
 * M2 stub. Throws `Not implemented` — the real implementation will compose
 * AI field extraction, dealbreaker checks, and `BatchService.submit`.
 * Registered in `appContext` now so M2 only needs to swap this class.
 */
export class ScoreApplicationServiceImpl implements ScoreApplicationService {
  /** @inheritdoc */
  async score(_options: ScoreOptions): Promise<ScoreResult> {
    throw new Error('Not implemented');
  }
}
