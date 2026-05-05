import { aiClient } from '../ai/index.js';
import { log } from '../../utils/logger.js';
import { stripComments } from '../../utils/stripComments.js';
import { TIER_NAMES, tierIndexOf, type TierIndex } from '../../utils/scoringTiers.js';
import SCORE_SYSTEM_PROMPT from './prompts/score-system.md';
import type { BatchService, BatchAiCallRequest, BatchAiProvider } from '../batchService.js';
import type {
  ScoringService,
  ScoreOutcome,
  BatchSubmissionSummary,
  JobToScore,
} from '../scoringService.js';
import type { Job } from '../../utils/types/index.js';
import type { AiConfig } from '../../utils/types/index.js';

/**
 * Default `ScoringService`.
 *
 * Loads the system prompt from `./prompts/score-system.md`, builds a per-job
 * user prompt with profile + scoring guide + JD sections, and either calls
 * `aiClient` (for synchronous `--single` mode) or `BatchService.submitAiBatch`
 * (default).
 *
 * The model emits `<tier>...</tier><pros>...</pros><cons>...</cons>`. Parsing
 * and assembly into a markdown blob (which lands in `Job.scoreJustification`)
 * is centralized in `parseScoreResponse` so the application service can reuse
 * it when applying batch results back to Job rows.
 */
export class ScoringServiceImpl implements ScoringService {
  constructor(private readonly batchService: BatchService) {}

  /** @inheritdoc */
  async scoreOne(
    job: Job,
    jdText: string,
    profileMd: string,
    profileScoreMd: string,
    aiConfig: AiConfig,
  ): Promise<ScoreOutcome> {
    const userPrompt = buildUserPrompt(job, jdText, profileMd, profileScoreMd);

    log.debug('ai.score.start', {
      jobId: job.id,
      provider: aiConfig.provider,
      model: aiConfig.model,
    });
    const startedAt = Date.now();
    const raw = await aiClient(userPrompt, SCORE_SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });
    log.info('ai.score.done', {
      jobId: job.id,
      durationMs: Date.now() - startedAt,
      responseLength: raw.length,
    });

    const parsed = parseScoreResponse(raw);
    if (!parsed.ok) {
      log.error('ai.score.parse_error', { jobId: job.id, error: parsed.error });
      throw new Error(`ScoringService: failed to parse model output: ${parsed.error}`);
    }
    return parsed.value;
  }

  /** @inheritdoc */
  async submitBatch(
    jobs: JobToScore[],
    profileMd: string,
    profileScoreMd: string,
    profileId: string,
    aiConfig: AiConfig,
  ): Promise<BatchSubmissionSummary> {
    if (jobs.length === 0) {
      throw new Error('ScoringService.submitBatch: no jobs to score');
    }
    const batchProvider = toBatchProvider(aiConfig.provider);

    const requests: BatchAiCallRequest[] = jobs.map(({ job, jdText }) => ({
      customId: job.id,
      prompt: buildUserPrompt(job, jdText, profileMd, profileScoreMd),
      systemPrompt: SCORE_SYSTEM_PROMPT,
    }));

    const submission = await this.batchService.submitAiBatch(requests, {
      type: 'score',
      profileId,
      provider: batchProvider,
      model: aiConfig.model,
    });
    log.info('ai.score.batch_submitted', {
      batchId: submission.id,
      providerBatchId: submission.batchId,
      profileId,
      submitted: submission.submitted,
    });
    return { batchId: submission.id, submitted: submission.submitted };
  }
}

// ---------------------------------------------------------------------------
// Pure helpers — exported for the application service and unit tests.
// ---------------------------------------------------------------------------

/**
 * Discriminated result of `parseScoreResponse`. Lets callers decide whether
 * to write a clean Job row or set `error: 'score_error'` without throwing
 * through layers.
 */
export type ParseResult =
  | { ok: true; value: ScoreOutcome }
  | { ok: false; error: string };

/**
 * Extract `<tier>`, `<pros>`, and `<cons>` from a model response, validate
 * the tier name, and assemble a canonical markdown blob suitable for
 * `Job.scoreJustification`.
 *
 * Surrounding prose is tolerated. Missing or unknown tier values, missing
 * pros/cons tags, and empty pros lists are rejected.
 */
export function parseScoreResponse(raw: string): ParseResult {
  const tierMatch = raw.match(/<tier>([\s\S]*?)<\/tier>/i);
  if (!tierMatch) return { ok: false, error: 'missing <tier> tag' };
  const prosMatch = raw.match(/<pros>([\s\S]*?)<\/pros>/i);
  if (!prosMatch) return { ok: false, error: 'missing <pros> tag' };
  const consMatch = raw.match(/<cons>([\s\S]*?)<\/cons>/i);
  if (!consMatch) return { ok: false, error: 'missing <cons> tag' };

  const tierText = tierMatch[1]!.trim();
  const tierIndex: TierIndex | null = tierIndexOf(tierText);
  if (tierIndex === null) {
    return {
      ok: false,
      error: `<tier> must be one of: ${TIER_NAMES.join(', ')} (got "${tierText}")`,
    };
  }

  const pros = prosMatch[1]!.trim();
  const cons = consMatch[1]!.trim();

  if (pros.length === 0) {
    return { ok: false, error: '<pros> is empty (use a single "-" line for an empty list)' };
  }

  const comment = assembleComment(tierIndex, pros, cons);
  return { ok: true, value: { tier: tierIndex, comment } };
}

function assembleComment(tier: TierIndex, pros: string, cons: string): string {
  const tierName = TIER_NAMES[tier];
  // Canonical Markdown shape — lets `wolf score show <id>` print readable
  // output and `wolf job set scoreJustification ...` round-trip cleanly.
  return `## Tier\n${tierName}\n\n## Pros\n${pros}\n\n## Cons\n${cons}\n`;
}

// ---------------------------------------------------------------------------
// Prompt-section builders.
// ---------------------------------------------------------------------------

function buildUserPrompt(
  job: Job,
  jdText: string,
  profileMd: string,
  profileScoreMd: string,
): string {
  const sections = [
    `## Candidate Profile (profile.md)\n${stripComments(profileMd, { dropEmptyH2s: true })}`,
    profileScoreSection(profileScoreMd),
    buildJobSection(job, jdText),
    'Score this job now. Output the three tags only — no other text.',
  ].filter((s) => s.length > 0);
  return sections.join('\n\n');
}

// Optional profile-level scoring guide. When the user has not customized
// `profiles/<name>/score.md`, the file body is just the `>` placeholder
// header which `stripComments` removes — `stripped` is empty and we omit
// the section entirely so the model doesn't see a bare heading.
function profileScoreSection(profileScoreMd: string): string {
  const stripped = stripComments(profileScoreMd, { dropEmptyH2s: false }).trim();
  if (stripped.length === 0) return '';
  return `## Profile-level scoring guide (score.md)\n${stripped}`;
}

function buildJobSection(job: Job, jdText: string): string {
  const header = [
    `Title: ${job.title}`,
    `Company: ${job.companyId}`,
    `Location: ${job.location}`,
    `Remote: ${job.remote ? 'yes' : 'no'}`,
    formatSalary(job.salaryLow, job.salaryHigh),
    `Sponsorship: ${job.workAuthorizationRequired}`,
    `Clearance required: ${job.clearanceRequired ? 'yes' : 'no'}`,
  ].join('\n');
  return `## Job Posting\n\n${header}\n\n### Job Description\n${jdText}`;
}

function formatSalary(low: number | null, high: number | null): string {
  if (low === null && high === null) return 'Salary: not listed';
  if (low === high) return `Salary: $${low}`;
  return `Salary: $${low ?? '?'}–$${high ?? '?'}`;
}

function toBatchProvider(provider: string): BatchAiProvider {
  if (provider === 'anthropic' || provider === 'openai') return provider;
  throw new Error(
    `ScoringService.submitBatch: provider "${provider}" is not supported by Batch API. ` +
    `Use --ai-model with an anthropic/* or openai/* model, or pass --single to score synchronously.`,
  );
}
