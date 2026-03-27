/**
 * score/index.ts — Job processing command.
 *
 * Reads unscored jobs from SQLite, extracts structured fields via AI,
 * applies dealbreaker filters, then submits remaining jobs to the
 * Claude Batch API for async scoring.
 *
 * ## Two modes
 *
 * Default (batch):
 *   Submits all unscored jobs to Batch API and returns immediately.
 *   Results are written back to the DB when the batch completes (polled by
 *   wolf status or wolf score --poll).
 *
 * Single (options.single = true):
 *   Scores one specific job synchronously via Haiku. Returns the score and
 *   justification immediately. Used by the wolf_add → wolf_score AI flow.
 *
 * ## Hybrid scoring
 *
 * Claude scores only roleMatch (the hardest part — requires semantic understanding).
 * Structured dimensions are scored algorithmically:
 *   - workAuth: does the job's sponsorship requirement match the user's status?
 *   - location: does the job's location match targetLocations?
 *   - remote: does the job's remote policy match the user's preference?
 *   - salary: does the listed salary meet the user's minimum?
 *   - companySize: does the company size match preferences?
 *
 * Final score = weighted sum of all dimensions (weights from profile.scoringPreferences.weights).
 */

import type { Job, ScoreOptions, ScoreResult } from '../../types/index.js';
import type { UserProfile } from '../../types/index.js';
import type { ScoringResponse } from '../../utils/batch.js';

/**
 * Fields that wolf score extracts from each job's raw description text.
 * Claude reads the JD and returns this structure.
 * These are saved to the job record and used for dealbreaker checks and
 * algorithmic scoring before Claude scores roleMatch.
 */
export interface ExtractedJobFields {
  sponsorshipOffered: boolean | null;  // true/false/null (null = unclear from JD)
  techStack: string[];                 // e.g. ["React", "Node.js", "PostgreSQL"]
  remote: 'remote' | 'hybrid' | 'onsite' | null;
  salaryMin: number | null;            // annual USD, null if not listed
  salaryMax: number | null;
  locationCity: string | null;         // parsed city from JD
}

/**
 * Processes unscored jobs: extracts fields, applies dealbreakers, scores via AI.
 *
 * @param options - Score options.
 *   - jobIds: score only these jobs; omit to score all with score=null
 *   - single: if true, score synchronously via Haiku (requires jobIds with exactly one id)
 *   - poll: if true, poll pending batches instead of submitting new ones
 *   - profileId: which profile to use for dealbreakers and scoring
 *   - aiProvider: 'anthropic' (default) or 'openai'
 * @returns submitted count, filtered count, and (if single=true) score + comment.
 * @throws If WOLF_ANTHROPIC_API_KEY is not set.
 * @throws If single=true but jobIds has 0 or more than 1 entry.
 */
export async function score(_options: ScoreOptions): Promise<ScoreResult> {
  // TODO(M2):
  // 0. If options.poll: call pollAll() and return early with polled count
  // 1. Load config + profile, initialize DB
  // 2. Fetch unscored jobs (filter by options.jobIds if provided)
  //    Return early if no jobs to score
  // 3. For each job, call aiClient (from utils/ai.ts) to extract ExtractedJobFields
  //    from job.description — sponsorship, remote, salary, tech stack, location
  // 4. Apply dealbreakers (applyDealbreakers); mark filtered jobs as status 'filtered' in DB
  // 5a. If options.single: call scoreSingle(job, profile), return score + comment immediately
  // 5b. Otherwise: register scoreResultHandler, submit batch, return submitted count
  throw new Error('Not implemented');
}

/**
 * Applies dealbreaker rules from the user's profile to a list of jobs.
 * Jobs that violate a hard constraint are removed from the scoring queue.
 *
 * Current dealbreakers (from profile.scoringPreferences.dealbreakers):
 *   - sponsorship: if 'required' and job.sponsorshipOffered === false → filtered
 *   - remote: if 'required' and job.remote === 'onsite' → filtered
 *
 * @returns pass (jobs that cleared all dealbreakers) and filtered (jobs that did not).
 */
export function applyDealbreakers(
  _jobs: unknown[],
  _extractedFields: Map<string, ExtractedJobFields>,
  _profile: unknown
): { pass: unknown[]; filtered: unknown[] } {
  // TODO(M2):
  // For each job:
  //   const fields = extractedFields.get(job.id);
  //   if (profile.scoringPreferences.dealbreakers.sponsorship === 'required'
  //       && fields?.sponsorshipOffered === false) → filtered
  //   if (profile.scoringPreferences.dealbreakers.remote === 'required'
  //       && fields?.remote === 'onsite') → filtered
  //   Otherwise → pass
  return { pass: [], filtered: [] };
}

/**
 * Batch result handler for 'score' batches.
 * Called by batch.pollAll() when a scoring batch completes.
 * Parses each result, validates it, and writes score + justification to the DB.
 *
 * @param results - Map of jobId → raw JSON string from Claude
 * @param _profile - The profile used when the batch was submitted (for future use)
 */
export async function scoreResultHandler(
  results: Map<string, string>,
  _profile: unknown
): Promise<void> {
  // TODO(M2):
  // For each jobId → rawJson in results:
  //   Parse rawJson as ScoringResponse
  //   Validate: score in [0.0, 1.0], justification non-empty — throw if invalid
  //   Write score, scoreJustification, status 'new' back to DB via updateJob
}

/**
 * Scores a single job synchronously using Haiku (no batch, returns immediately).
 * Used by wolf score --single and the wolf_add → wolf_score AI orchestrator flow.
 *
 * @param job - The job to score
 * @param profile - Profile to score against
 * @returns Score (0.0–1.0), justification string, and optional flags
 * @throws If WOLF_ANTHROPIC_API_KEY is not set, or Claude returns invalid JSON
 * @throws If score is outside [0.0, 1.0] or justification is missing
 */
export async function scoreSingle(
  _job: Job,
  _profile: UserProfile
): Promise<ScoringResponse> {
  // TODO(M2):
  // 1. Build prompt from job + profile (same structure as batch submit, single item)
  //    - profileSummary: extract skills, targetRoles, immigrationStatus from profile
  //    - dealbreakers: extract from profile.scoringPreferences.dealbreakers
  // 2. Call aiClient(prompt, systemPrompt, { model: 'claude-haiku-4-5-20251001' }) from utils/ai.ts
  //    Prompt must instruct Claude to return JSON matching ScoringResponse
  // 3. Parse response JSON → validate:
  //    - score must be number in [0.0, 1.0]
  //    - justification must be non-empty string
  // 4. Update job in DB: db.updateJob(job.id, { score, scoreJustification: justification, status: 'new' })
  // 5. Return ScoringResponse
  throw new Error('Not implemented');
}
