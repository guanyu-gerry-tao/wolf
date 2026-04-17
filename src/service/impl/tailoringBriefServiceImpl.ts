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
    // User Guidance section only appears when hint is non-empty — keeps the prompt
    // clean when no guidance was provided.
    const guidanceSection = hint?.trim()
      ? `\n\n## User Guidance (authoritative - align the brief to this)\n${hint.trim()}`
      : '';

    const userPrompt = `## Candidate
Name: ${profile.name}
Target roles: ${profile.targetRoles.join(', ') || 'unspecified'}

## Resume Pool
${stripComments(resumePool)}

## Job Description
${jdText}${guidanceSection}

Produce the tailoring brief now.`;

    const text = await aiClient(userPrompt, ANALYST_SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });

    const trimmed = text.trim();
    if (!trimmed) throw new Error('TailoringBriefService: AI returned an empty brief');
    return trimmed;
  }
}
