import type { AiConfig } from '../types/index.js';
import type { UserProfile } from '../types/index.js';

export interface ResumeCoverLetterService {
  /**
   * Select and rewrite resume content to match a job description.
   * @param resumePool - Full resume content pool from resume_pool.md
   * @param jdText - Full job description text
   * @param profile - User profile for contact info and context
   * @param aiConfig - Resolved provider and model for this call
   * @returns HTML body string to inject into shell.html's #resume-root
   * @throws if the AI returns an empty response
   */
  tailorResumeToHtml(
    resumePool: string,
    jdText: string,
    profile: UserProfile,
    aiConfig: AiConfig,
  ): Promise<string>;
}
