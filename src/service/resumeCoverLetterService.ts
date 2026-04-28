import type { AiConfig, Profile } from '../types/index.js';

export interface ResumeCoverLetterService {
  /**
   * Select and rewrite resume content to match a job description, guided by the analyst's brief.
   * @param resumePool - Full resume content pool from resume_pool.md
   * @param jdText - Full job description text
   * @param profile - Candidate identity (name + profile.md). The full profile.md
   *                  is included verbatim in the prompt so the AI sees contact
   *                  info, address, links, and any user-authored notes.
   * @param brief - Markdown tailoring brief produced by TailoringBriefService
   * @param aiConfig - Resolved provider and model for this call
   * @returns HTML body string to inject into shell.html's #resume-root
   * @throws if the AI returns an empty response
   */
  tailorResumeToHtml(
    resumePool: string,
    jdText: string,
    profile: Profile,
    brief: string,
    aiConfig: AiConfig,
  ): Promise<string>;

  /**
   * Generate a cover letter as an HTML body, guided by the analyst's brief.
   * @param resumePool - Full resume content pool (for raw material)
   * @param jdText - Full job description text
   * @param profile - Candidate identity (name + profile.md content)
   * @param brief - Markdown tailoring brief produced by TailoringBriefService
   * @param tone - e.g. "professional", "conversational"
   * @param aiConfig - Resolved provider and model for this call
   * @returns HTML body string (no <html>/<head>/<body> tags)
   * @throws if the AI returns an empty response
   */
  generateCoverLetter(
    resumePool: string,
    jdText: string,
    profile: Profile,
    brief: string,
    tone: string,
    aiConfig: AiConfig,
  ): Promise<string>;
}
