import type { ScoreOptions, ScoreResult } from '../../utils/types/index.js';
import type { ScoreApplicationService } from '../scoreApplicationService.js';

export class ScoreApplicationServiceImpl implements ScoreApplicationService {
  async score(_options: ScoreOptions): Promise<ScoreResult> {
    throw new Error('Not implemented');
  }
}
