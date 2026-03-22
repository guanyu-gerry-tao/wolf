import type { AddOptions, AddResult } from '../../types/index.js';

/**
 * Stores a single job submitted by an AI orchestrator (MCP-only entry point).
 *
 * Designed for AI-driven flows where the user shares a job with Claude/OpenClaw
 * (screenshot, pasted JD, or URL content). The AI caller is responsible for
 * extracting structured fields before calling this function — wolf only stores.
 *
 * Typical chain: wolf_add → wolf_score({ single: true }) → wolf_tailor
 *
 * @param _options - Structured job data extracted by the AI caller.
 * @returns jobId for chaining into wolf_score or wolf_tailor.
 */
export async function add(_options: AddOptions): Promise<AddResult> {
  // TODO(M2): save job to SQLite with { status: 'raw', score: null }
  // TODO(M2): return { jobId }
  throw new Error('Not implemented');
}
