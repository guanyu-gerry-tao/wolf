import type { FillOptions, FillResult } from '../../utils/types/index.js';
import type { FillApplicationService } from '../fillApplicationService.js';

export class FillApplicationServiceImpl implements FillApplicationService {
  async fill(_options: FillOptions): Promise<FillResult> {
    throw new Error('Not implemented');
  }
}
