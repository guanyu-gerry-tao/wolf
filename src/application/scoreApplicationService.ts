import type { ScoreOptions, ScoreResult } from '../utils/types/index.js';

export interface ScoreApplicationService {
  // M2: AI extraction + dealbreaker filters + Batch API submission.
  score(options: ScoreOptions): Promise<ScoreResult>;
}
