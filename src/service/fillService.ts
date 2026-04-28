import type { FillOptions, FillResult } from '../utils/types/index.js';

export interface FillService {
  // M4 entry point: Playwright-driven form fill. Reads JD URL + tailored
  // resume/cover-letter paths from the job row, navigates the page, maps
  // detected fields to profile data, and (unless dryRun) submits.
  run(options: FillOptions): Promise<FillResult>;
}
