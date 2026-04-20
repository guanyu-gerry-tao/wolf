import { aiClient } from '../../utils/ai/index.js';
import { stripComments } from '../../utils/stripComments.js';
import SYSTEM_PROMPT from './prompts/tailor-system.md';
import COVER_LETTER_SYSTEM_PROMPT from './prompts/cover-letter-system.md';
import type { ResumeCoverLetterService } from '../resumeCoverLetterService.js';
import type { AiConfig, UserProfile } from '../../types/index.js';

export class ResumeCoverLetterServiceImpl implements ResumeCoverLetterService {
  async tailorResumeToHtml(
    resumePool: string,
    jdText: string,
    profile: UserProfile,
    brief: string,
    aiConfig: AiConfig,
  ): Promise<string> {
    // Build the prompt sections so each block reads as its own unit.
    const contactSection = buildContactSection(profile);
    const briefSection = buildBriefSection(brief);
    const poolSection = buildResumePoolSection(resumePool);
    const jdSection = buildJdSection(jdText);
    const instruction = "Produce the tailored resume HTML body now, following the brief's selections.";

    const userPrompt = [contactSection, briefSection, poolSection, jdSection, instruction].join('\n\n');

    // Send to the configured AI provider and require a non-empty response.
    const raw = await aiClient(userPrompt, SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });
    return validateNonEmptyResponse(raw, 'resume');
  }

  async generateCoverLetter(
    resumePool: string,
    jdText: string,
    profile: UserProfile,
    brief: string,
    tone: string,
    aiConfig: AiConfig,
  ): Promise<string> {
    // Same prompt shape as the resume path, plus a Tone line in the contact block.
    const contactSection = buildContactSection(profile, tone);
    const briefSection = buildBriefSection(brief);
    const poolSection = buildResumePoolSection(resumePool);
    const jdSection = buildJdSection(jdText);
    const instruction = "Produce the cover letter HTML body now, following the brief's angle and themes.";

    const userPrompt = [contactSection, briefSection, poolSection, jdSection, instruction].join('\n\n');

    // Send to the configured AI provider and require a non-empty response.
    const raw = await aiClient(userPrompt, COVER_LETTER_SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });
    return validateNonEmptyResponse(raw, 'cover letter');
  }
}

// ---------------------------------------------------------------------------
// Prompt-section builders — extracted so each section reads as its own block
// in the public methods above. All section bodies are plain markdown.
// ---------------------------------------------------------------------------

// Join the profile's optional URLs with a separator, returning "none" when
// the user has set none of the three.
function formatProfileUrls(profile: UserProfile): string {
  const candidateUrls = [profile.firstUrl, profile.secondUrl, profile.thirdUrl];
  const presentUrls = candidateUrls.filter((u): u is string => Boolean(u));
  if (presentUrls.length === 0) return 'none';
  return presentUrls.join(' · ');
}

// Contact block — same shape for both resume and cover letter. The optional
// `tone` argument adds the cover-letter-only Tone line.
function buildContactSection(profile: UserProfile, tone?: string): string {
  const urls = formatProfileUrls(profile);
  const lines = [
    '## Candidate Contact Info',
    `Name: ${profile.name}`,
    `Email: ${profile.email}`,
    `Phone: ${profile.phone}`,
    `URLs: ${urls}`,
  ];
  if (tone !== undefined) lines.push(`Tone: ${tone}`);
  return lines.join('\n');
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
