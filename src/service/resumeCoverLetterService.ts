import type { AiConfig, UserProfile } from '../types/index.js';

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

  /**
   * Generate a cover letter as an HTML body for the given job and profile.
   * @param resumePool - Full resume content pool (for context)
   * @param jdText - Full job description text
   * @param profile - Candidate contact info and background
   * @param tone - e.g. "professional", "conversational"
   * @param aiConfig - Resolved provider and model for this call
   * @returns HTML body string (no <html>/<head>/<body> tags)
   * @throws if the AI returns an empty response
   */
  generateCoverLetter(
    resumePool: string,
    jdText: string,
    profile: UserProfile,
    tone: string,
    aiConfig: AiConfig,
  ): Promise<string>;
}
