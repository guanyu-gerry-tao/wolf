import type { FillOptions, FillResult } from '../../utils/types/index.js';
import type { FillService } from '../fillService.js';

/**
 * M4 stub. Throws `Not implemented` — the real impl will use Playwright
 * to load `job.url`, detect form fields, map them to the profile, fill,
 * and (when not dry-run) submit. Wired through `appContext` now so M4
 * only needs to swap this class.
 */
export class FillServiceImpl implements FillService {
  /** @inheritdoc */
  async run(_options: FillOptions): Promise<FillResult> {
    throw new Error('Not implemented');
  }
}
