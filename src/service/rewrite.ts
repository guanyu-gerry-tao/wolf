import type { UserProfile } from '../types/index.js';

export interface RewriteService {
  /**
   * Select and rewrite resume content to match a job description.
   * @param resumePool - Full resume content pool from resume_pool.md
   * @param jdText - Full job description text
   * @param profile - User profile for contact info and context
   * @returns HTML body string to inject into shell.html's #resume-root
   * @throws if the AI returns an empty response
   */
  tailorResumeToHtml(
    resumePool: string,
    jdText: string,
    profile: UserProfile,
  ): Promise<string>;
}
