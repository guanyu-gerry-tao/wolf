import type { FillOptions, FillResult } from '../utils/types/index.js';

/**
 * Domain service for `wolf fill` (Milestone 4). Hides the Playwright
 * machinery — page navigation, field detection, mapping detected fields
 * to profile data, screenshot capture — behind a single `run` call.
 * Currently a stub; full implementation lands in M4.
 */
export interface FillService {
  // M4 entry point: Playwright-driven form fill. Reads JD URL + tailored
  // resume/cover-letter paths from the job row, navigates the page, maps
  // detected fields to profile data, and (unless dryRun) submits.
  run(options: FillOptions): Promise<FillResult>;
}
