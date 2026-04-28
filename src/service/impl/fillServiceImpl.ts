import type { FillOptions, FillResult } from '../../utils/types/index.js';
import type { FillService } from '../fillService.js';

export class FillServiceImpl implements FillService {
  async run(_options: FillOptions): Promise<FillResult> {
    throw new Error('Not implemented');
  }
}
