import type { HuntOptions, HuntResult } from '../../utils/types/index.js';
import type { HuntApplicationService } from '../huntApplicationService.js';

export class HuntApplicationServiceImpl implements HuntApplicationService {
  async hunt(_options: HuntOptions): Promise<HuntResult> {
    throw new Error('Not implemented');
  }
}
