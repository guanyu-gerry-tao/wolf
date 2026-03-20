import type { TailorOptions, TailorResult } from '../../types/index.js';

/**
 * Tailors a resume and optionally generates a cover letter for a specific job.
 *
 * Pipeline:
 * 1. Fetch job record from SQLite
 * 2. Load base resume `.tex` from profile.resumePath
 * 3. Parse `.tex` into structured Resume
 * 4. Call Claude API to rewrite bullet points to match the JD
 * 5. Write tailored `.tex` and compile to PDF via xelatex
 * 6. Generate cover letter `.md` and compile to PDF via md-to-pdf
 * 7. Update job record in SQLite with tailored file paths
 *
 * @param _options - Must include `jobId`; other fields override profile defaults.
 * @returns Paths to generated files, list of changes, and match score.
 * @throws If the job does not exist, resume file is missing, or Claude API fails.
 */
export async function tailor(_options: TailorOptions): Promise<TailorResult> {
  // TODO: fetch job from SQLite
  // TODO: load resume .tex from profile.resumePath
  // TODO: parse .tex into structured Resume
  // TODO: call Claude API to rewrite bullet points
  // TODO: write tailored .tex, compile to PDF via xelatex
  // TODO: generate cover letter .md, compile to PDF via md-to-pdf
  // TODO: update job record with tailored paths
  throw new Error('Not implemented');
}
