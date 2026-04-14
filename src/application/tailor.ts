import type { TailorResult } from '../types/index.js';

export interface TailorApplicationService {
  /**
   * Tailor a resume for a specific job.
   * 1. Load Job + UserProfile from repositories
   * 2. Call RewriteService to produce tailored HTML body
   * 3. Call RenderService to produce one-page PDF
   * 4. Write PDF to data/<company>_<title>_<jobId>/resume.pdf
   * 5. Update job record with tailoredResumePdfPath
   * @throws if job not found, AI fails, or render fails
   */
  tailor(jobId: string, profileId?: string): Promise<TailorResult>;
}
