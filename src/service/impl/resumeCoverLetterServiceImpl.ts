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
    const urls = [profile.firstUrl, profile.secondUrl, profile.thirdUrl]
      .filter(Boolean)
      .join(' · ');

    const userPrompt = `## Candidate Contact Info
Name: ${profile.name}
Email: ${profile.email}
Phone: ${profile.phone}
URLs: ${urls || 'none'}

## Tailoring Brief
${brief}

## Resume Pool
${stripComments(resumePool)}

## Job Description
${jdText}

Produce the tailored resume HTML body now, following the brief's selections.`;

    const text = await aiClient(userPrompt, SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });

    const trimmed = text.trim();
    if (!trimmed) throw new Error('ResumeCoverLetterService: AI returned an empty response');
    return trimmed;
  }

  async generateCoverLetter(
    resumePool: string,
    jdText: string,
    profile: UserProfile,
    brief: string,
    tone: string,
    aiConfig: AiConfig,
  ): Promise<string> {
    const urls = [profile.firstUrl, profile.secondUrl, profile.thirdUrl]
      .filter(Boolean)
      .join(' · ');

    const userPrompt = `## Candidate Contact Info
Name: ${profile.name}
Email: ${profile.email}
Phone: ${profile.phone}
URLs: ${urls || 'none'}
Tone: ${tone}

## Tailoring Brief
${brief}

## Resume Pool
${stripComments(resumePool)}

## Job Description
${jdText}

Produce the cover letter HTML body now, following the brief's angle and themes.`;

    const text = await aiClient(userPrompt, COVER_LETTER_SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });

    const trimmed = text.trim();
    if (!trimmed) throw new Error('ResumeCoverLetterService: AI returned an empty cover letter response');
    return trimmed;
  }
}
