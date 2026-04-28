import { aiClient } from '../../service/ai/index.js';
import { log } from '../../utils/logger.js';
import { stripComments } from '../../utils/stripComments.js';
import SYSTEM_PROMPT from './prompts/tailor-system.md';
import COVER_LETTER_SYSTEM_PROMPT from './prompts/cover-letter-system.md';
import type { ResumeCoverLetterService } from '../resumeCoverLetterService.js';
import type { AiConfig, Profile } from '../../utils/types/index.js';

/**
 * Anthropic-backed `ResumeCoverLetterService`. Loads the prompts bundled
 * under `service/impl/prompts/`, fills them with `(pool, jd, profile, brief)`,
 * calls `aiClient`, and returns the raw HTML body. Empty AI responses throw
 * rather than silently rendering a blank PDF.
 */
export class ResumeCoverLetterServiceImpl implements ResumeCoverLetterService {
  /** @inheritdoc */
  async tailorResumeToHtml(
    resumePool: string,
    jdText: string,
    profile: Profile,
    brief: string,
    aiConfig: AiConfig,
  ): Promise<string> {
    // Build the prompt sections so each block reads as its own unit.
    const profileSection = buildProfileSection(profile);
    const briefSection = buildBriefSection(brief);
    const poolSection = buildResumePoolSection(resumePool);
    const jdSection = buildJdSection(jdText);
    const instruction = "Produce the tailored resume HTML body now, following the brief's selections. Use the contact details from the Candidate Profile section for the resume header.";

    const userPrompt = [profileSection, briefSection, poolSection, jdSection, instruction].join('\n\n');

    // Bracket the AI call with start/done events so cost signals (durationMs,
    // responseLength) end up in data/logs/wolf.log.jsonl for post-hoc analysis.
    log.debug('ai.resume.start', {
      profileName: profile.name,
      provider: aiConfig.provider,
      model: aiConfig.model,
    });
    const startedAt = Date.now();
    const raw = await aiClient(userPrompt, SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });
    log.info('ai.resume.done', {
      profileName: profile.name,
      durationMs: Date.now() - startedAt,
      responseLength: raw.length,
    });

    // Validate-or-throw. Log before the throw so the failure leaves a
    // structured breadcrumb even when the process exits.
    return validateAndLogOrThrow(raw, 'resume', profile.name);
  }

  /** @inheritdoc */
  async generateCoverLetter(
    resumePool: string,
    jdText: string,
    profile: Profile,
    brief: string,
    tone: string,
    aiConfig: AiConfig,
  ): Promise<string> {
    // Same prompt shape as the resume path, plus a Tone line appended.
    const profileSection = buildProfileSection(profile);
    const briefSection = buildBriefSection(brief);
    const poolSection = buildResumePoolSection(resumePool);
    const jdSection = buildJdSection(jdText);
    const toneLine = `## Tone\n${tone}`;
    const instruction = "Produce the cover letter HTML body now, following the brief's angle and themes. Use the candidate's name and contact details from the Candidate Profile section.";

    const userPrompt = [profileSection, briefSection, poolSection, jdSection, toneLine, instruction].join('\n\n');

    // Bracket the AI call with start/done events — same shape as the resume path.
    log.debug('ai.cover.start', {
      profileName: profile.name,
      provider: aiConfig.provider,
      model: aiConfig.model,
    });
    const startedAt = Date.now();
    const raw = await aiClient(userPrompt, COVER_LETTER_SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });
    log.info('ai.cover.done', {
      profileName: profile.name,
      durationMs: Date.now() - startedAt,
      responseLength: raw.length,
    });

    return validateAndLogOrThrow(raw, 'cover letter', profile.name);
  }
}

// Validate + log-on-failure wrapper. Produces the same thrown Error as
// the pure validateNonEmptyResponse helper, but emits a structured
// `error` event first so the failure is visible in the log file.
function validateAndLogOrThrow(
  raw: string,
  what: 'resume' | 'cover letter',
  profileName: string,
): string {
  try {
    return validateNonEmptyResponse(raw, what);
  } catch (err) {
    const eventName = what === 'resume' ? 'ai.resume.empty_response' : 'ai.cover.empty_response';
    log.error(eventName, { profileName });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Prompt-section builders — extracted so each section reads as its own block
// in the public methods above. All section bodies are plain markdown.
// ---------------------------------------------------------------------------

// Profile.md is included verbatim. The AI gets full identity context (name,
// contact, address, demographics, work auth, links) in user-authored markdown
// — much richer than the old typed-field summary block.
function buildProfileSection(profile: Profile): string {
  return `## Candidate Profile (profile.md)\n${profile.md}`;
}

function buildBriefSection(brief: string): string {
  return `## Tailoring Brief\n${brief}`;
}

// Strip `//` comment lines from the pool before the AI sees them — those are
// human-only notes and would confuse the AI's selection of content.
function buildResumePoolSection(resumePool: string): string {
  return `## Resume Pool\n${stripComments(resumePool)}`;
}

function buildJdSection(jdText: string): string {
  return `## Job Description\n${jdText}`;
}

// Trim the AI response and reject empty output. Centralizing here keeps the
// thrown message consistent across both callers.
function validateNonEmptyResponse(raw: string, what: 'resume' | 'cover letter'): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(`ResumeCoverLetterService: AI returned an empty ${what} response`);
  }
  return trimmed;
}
