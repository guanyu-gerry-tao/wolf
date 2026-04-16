import type { TailorOptions, TailorResult } from '../types/index.js';

export interface TailorApplicationService {
  /**
   * Tailor a resume (and optionally a cover letter) for a specific job.
   * Accepts full TailorOptions so AI provider overrides flow through.
   * @throws if job not found, AI fails, or render fails
   */
  tailor(options: TailorOptions): Promise<TailorResult>;
}
