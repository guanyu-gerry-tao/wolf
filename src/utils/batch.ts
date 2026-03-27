/**
 * batch.ts — AI batch job lifecycle management.
 *
 * Handles submitting jobs to AI provider Batch APIs (Anthropic / OpenAI),
 * tracking batch status in SQLite, and writing results back to the jobs table
 * when a batch completes.
 *
 * ## Why a generic batch module?
 *
 * Multiple commands (score, tailor) may use batch APIs. This module keeps
 * batch mechanics in one place so commands only call submit() and pollAll().
 *
 * ## Typical flow
 *
 *   wolf score:
 *     → batch.submit(jobs, { type: 'score', profile, aiProvider: 'anthropic' })
 *       → sends requests to Anthropic Batch API
 *       → stores batchId + status='pending' in SQLite via db.saveBatch()
 *       → returns immediately (batch runs in background, up to 24h)
 *
 *   wolf status  (or wolf score --poll):
 *     → batch.pollAll()
 *       → reads all pending batches from db.getPendingBatches()
 *       → for each batch, calls the AI provider to check completion
 *       → if completed: calls the registered handler to write results to jobs table
 *       → updates batch status to 'completed' or 'failed' in SQLite
 */

import type { Job } from '../types/index.js';
import type { UserProfile } from '../types/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for submitting a new batch. */
export interface BatchSubmitOptions {
  type: 'score' | 'tailor';   // which command is submitting
  aiProvider: 'anthropic' | 'openai';
  profile: UserProfile;        // used to build the scoring/tailoring prompt
  profileId: string;           // stored in DB so pollAll() can reload the profile later
}

/**
 * A single scoring request sent to the AI in a batch.
 * Each item maps to one job.
 */
export interface ScoringRequest {
  jobId: string;       // used as custom_id so results can be matched back
  jdText: string;      // full job description
  profileSummary: string;  // distilled from UserProfile — skills, target role, immigration status
  dealbreakers: string[];  // hard constraints from profile (e.g. "must sponsor", "remote only")
}

/**
 * The structure wolf expects Claude to return for each scored job.
 * Claude's response must be valid JSON matching this shape.
 * Validated before writing to DB — rejects hallucinated or out-of-range values.
 */
export interface ScoringResponse {
  score: number;          // MUST be in [0.0, 1.0] — rejected otherwise
  justification: string;  // MUST be non-empty — explains why the job scored this way,
                          // what matches well, and any flags or concerns
  flags: string[];        // optional concerns, e.g. ["requires on-site", "sponsorship unclear"]
}

/** Summary returned by pollAll(). */
export interface PollResult {
  checked: number;        // number of pending batches checked
  completed: number;      // batches where all items succeeded
  partialFailed: number;  // batches where some items failed (successful ones still written to DB)
  stillPending: number;   // batches still running
  failed: number;         // batches that failed entirely (all items remain score: null)
  failedJobIds: string[]; // jobIds that could not be scored (from all batches this poll)
                          // these jobs remain score: null and will be retried on next wolf score run
                          // both Anthropic and OpenAI return per-item custom_id so this is always accurate
}

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

/**
 * A batch result handler processes completed batch results for one command type.
 * Each command that uses batching registers a handler here.
 *
 * @param results - Map of jobId → raw AI response string (JSON)
 * @param profile - The profile that was used when the batch was submitted
 */
export type BatchResultHandler = (
  results: Map<string, string>,
  profile: UserProfile
) => Promise<void>;

const handlers = new Map<string, BatchResultHandler>();

/**
 * Registers a result handler for a given batch type.
 * Must be called once during app startup for each command that uses batching.
 *
 * Example:
 *   batch.registerHandler('score', scoreResultHandler);
 *
 * @param type - Matches BatchSubmitOptions.type
 * @param handler - Called with completed results when a batch of this type finishes
 */
export function registerHandler(type: string, handler: BatchResultHandler): void {
  handlers.set(type, handler);
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Submits a list of jobs to the AI Batch API for scoring.
 * Returns immediately — the batch runs asynchronously.
 * Stores the batchId and status='pending' in SQLite via db.saveBatch().
 *
 * @param jobs - Jobs to score (should have description populated)
 * @param options - Batch options including profile and AI provider
 * @returns The provider-assigned batchId (also stored in DB)
 * @throws If WOLF_ANTHROPIC_API_KEY (or OpenAI key) is not set, or API call fails
 */
export async function submit(
  jobs: Job[],
  options: BatchSubmitOptions
): Promise<string> {
  // TODO(M2):
  // 1. Build a ScoringRequest for each job (jobId, jdText, profileSummary, dealbreakers)
  // 2. Format all requests as Anthropic Batch API items (custom_id = jobId)
  //    Each item's prompt must instruct Claude to return JSON matching ScoringResponse
  //    Note: submit() calls the Batch API directly (NOT anthropicClient from utils/ai.ts)
  //    because Batch API has a different endpoint and request format than messages.create
  // 3. POST to Anthropic Batch API, receive provider batchId
  // 4. Save to DB via saveBatch (type, aiProvider, profileId) with status 'pending'
  // 5. Return batchId
  throw new Error('Not implemented');
}

/**
 * Checks all pending batches and processes any that have completed.
 * Calls the registered handler for each completed batch to write results to the DB.
 *
 * Called by:
 *   - wolf status (always runs before displaying results)
 *   - wolf score --poll (explicit poll without new submission)
 *
 * @returns Summary of what was checked and completed.
 */
export async function pollAll(): Promise<PollResult> {
  // TODO(M2):
  // 1. db.getPendingBatches() → list of BatchRecord
  // 2. Load config once: const config = await loadConfig() (from utils/config.ts)
  // 3. For each pending batch:
  //    a. Load profile: const profile = getProfile(config, batch.profileId)
  //    b. Call AI provider API to check status (GET /v1/messages/batches/:batchId)
  //    c. If still processing: skip (count as stillPending)
  //    d. If ended (Anthropic: processing_status === 'ended'):
  //       - Download all result items
  //       - Separate into succeeded items and errored items:
  //           succeeded: result.type === 'succeeded' → extract raw JSON from result.message.content[0].text
  //           errored:   result.type === 'errored' || result.type === 'canceled'
  //                      also treat as errored if JSON parse fails or ScoringResponse validation fails
  //                      (score out of range, missing justification) — these jobs stay score: null
  //       - If succeeded.length > 0:
  //           Build Map<jobId, rawResponseJson> from succeeded items only
  //           Look up handler by batch.type and call handler(results, profile)
  //       - If errored.length === 0: db.updateBatchStatus(batch.id, 'completed')
  //         If errored.length > 0 && succeeded.length > 0: db.updateBatchStatus(batch.id, 'partial_failed')
  //         If errored.length > 0 && succeeded.length === 0: db.updateBatchStatus(batch.id, 'failed')
  //       - Collect errored custom_ids into allFailedJobIds[]
  //         (Anthropic: items where result.type !== 'succeeded')
  //         (OpenAI: download error_file via batch.error_file_id, collect custom_ids)
  //       - Failed items: leave score: null — wolf score will resubmit them next run
  //    e. If entire batch API call fails (network error, auth error):
  //       db.updateBatchStatus(batch.id, 'failed') — jobs remain score: null for retry
  // 3. Return PollResult summary
  throw new Error('Not implemented');
}
