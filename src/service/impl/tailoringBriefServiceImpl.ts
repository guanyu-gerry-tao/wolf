import { aiClient } from '../../utils/ai/index.js';
import { stripComments } from '../../utils/stripComments.js';
import ANALYST_SYSTEM_PROMPT from './prompts/analyst-system.md';
import type { TailoringBriefService } from '../tailoringBriefService.js';
import type { AiConfig, UserProfile } from '../../types/index.js';

export class TailoringBriefServiceImpl implements TailoringBriefService {
  async analyze(
    resumePool: string,
    jdText: string,
    profile: UserProfile,
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

    // Send to the configured AI provider and require a non-empty response.
    const raw = await aiClient(userPrompt, ANALYST_SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });
    return validateNonEmptyBrief(raw);
  }
}

// ---------------------------------------------------------------------------
// Prompt-section builders — same shape as the sibling ResumeCoverLetter
// service. Each builder returns a complete, stand-alone section.
// ---------------------------------------------------------------------------

function buildCandidateSection(profile: UserProfile): string {
  // targetRoles can be empty for a brand-new profile; default to a sentinel
  // so the AI gets a readable value instead of an empty list.
  const targetRoles = profile.targetRoles.join(', ') || 'unspecified';
  return [
    '## Candidate',
    `Name: ${profile.name}`,
    `Target roles: ${targetRoles}`,
  ].join('\n');
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
