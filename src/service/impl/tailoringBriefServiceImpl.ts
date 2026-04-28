import { aiClient } from '../../service/ai/index.js';
import { log } from '../../utils/logger.js';
import { stripComments } from '../../utils/stripComments.js';
import ANALYST_SYSTEM_PROMPT from './prompts/analyst-system.md';
import type { TailoringBriefService } from '../tailoringBriefService.js';
import type { AiConfig, Profile } from '../../utils/types/index.js';

/**
 * Anthropic-backed `TailoringBriefService`. Loads the analyst system prompt
 * from `service/impl/prompts/analyst-system.md`, calls `aiClient`, and
 * returns the brief markdown. Strips template callouts from the profile
 * before feeding it to the model and treats user `hint` text as an
 * authoritative override injected under `## User Guidance`.
 */
export class TailoringBriefServiceImpl implements TailoringBriefService {
  /** @inheritdoc */
  async analyze(
    resumePool: string,
    jdText: string,
    profile: Profile,
    aiConfig: AiConfig,
    hint?: string,
  ): Promise<string> {
    // Build the prompt sections so each block reads as its own unit.
    const candidateSection = buildCandidateSection(profile);
    const poolSection = buildResumePoolSection(resumePool);
    const jdSection = buildJdSection(jdText);
    const guidanceSection = buildGuidanceSection(hint);
    const instruction = 'Produce the tailoring brief now.';

    // Guidance is omitted entirely when absent — no blank `## User Guidance`
    // heading reaches the AI. Filter out empty sections before joining.
    const sections = [candidateSection, poolSection, jdSection, guidanceSection, instruction];
    const userPrompt = sections.filter((s) => s.length > 0).join('\n\n');

    // Bracket the AI call with start/done events. `hintProvided` captures
    // whether the analyst was steered — useful when debugging brief quality.
    log.debug('ai.brief.start', {
      profileName: profile.name,
      provider: aiConfig.provider,
      model: aiConfig.model,
      hintProvided: guidanceSection.length > 0,
    });
    const startedAt = Date.now();
    const raw = await aiClient(userPrompt, ANALYST_SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });
    log.info('ai.brief.done', {
      profileName: profile.name,
      durationMs: Date.now() - startedAt,
      responseLength: raw.length,
    });

    // Validate-or-throw. Log before the throw so the failure leaves a
    // structured breadcrumb in data/logs/wolf.log.jsonl.
    try {
      return validateNonEmptyBrief(raw);
    } catch (err) {
      log.error('ai.brief.empty_response', { profileName: profile.name });
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Prompt-section builders — same shape as the sibling ResumeCoverLetter
// service. Each builder returns a complete, stand-alone section.
// ---------------------------------------------------------------------------

// Profile is included verbatim — the analyst reads name, contact, demographics,
// work auth and target roles directly from the user-authored markdown. Keeping
// the section labelled "Candidate Profile" lets the system prompt refer to it.
function buildCandidateSection(profile: Profile): string {
  return `## Candidate Profile (profile.md)\n${profile.md}`;
}

// Strip `//` comment lines from the pool before the AI sees them.
function buildResumePoolSection(resumePool: string): string {
  return `## Resume Pool\n${stripComments(resumePool)}`;
}

function buildJdSection(jdText: string): string {
  return `## Job Description\n${jdText}`;
}

// Optional user-authored guidance block. Returns an empty string when no
// hint was provided, so the caller can filter it out of the final prompt.
function buildGuidanceSection(hint: string | undefined): string {
  const trimmed = hint?.trim();
  if (trimmed === undefined || trimmed.length === 0) return '';
  return `## User Guidance (authoritative - align the brief to this)\n${trimmed}`;
}

// Trim the AI response and reject empty output.
function validateNonEmptyBrief(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('TailoringBriefService: AI returned an empty brief');
  }
  return trimmed;
}
