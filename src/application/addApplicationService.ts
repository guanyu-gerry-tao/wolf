import type { AddOptions, AddResult } from '../utils/types/index.js';

/**
 * Use case for storing a single, structured job submitted by an AI orchestrator
 * (the MCP `wolf_add` entry point). The caller — an AI agent — has already
 * extracted `{ title, company, jdText, url? }` from a screenshot, paste, or URL;
 * wolf only persists, never parses raw input.
 *
 * Typical chain on the AI side: `wolf_add` → `wolf_score --single` → `wolf_tailor`.
 */
export interface AddApplicationService {
  /**
   * Stores the job. Reuses an existing company row by exact name match;
   * otherwise creates one. Persists JD prose to disk (`jd.md`); only structured
   * metadata goes to SQLite.
   *
   * @returns The new `jobId`, suitable for chaining into score / tailor.
   */
  add(options: AddOptions): Promise<AddResult>;
}
