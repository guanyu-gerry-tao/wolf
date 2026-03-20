import type { ReachOptions, ReachResult } from '../../types/index.js';

/**
 * Finds HR contacts and drafts a personalized outreach email for a job.
 *
 * Pipeline:
 * 1. Fetch job and company from SQLite
 * 2. Search for recruiters/hiring managers via Apify LinkedIn people search
 * 3. If email not found, infer from Company.domain (e.g. first.last@company.com)
 * 4. Call Claude API to draft a personalized cold email
 * 5. Write draft to `.md` file under `data/outreach/`
 * 6. If `send` is true, send via Gmail API after interactive confirmation
 * 7. Update job record with outreachDraftPath
 *
 * @param _options - Must include `jobId`. Email is only sent if `send: true`.
 * @returns Found contacts, draft file path, and sent flag.
 * @throws If the company has no domain and no contact is found.
 */
export async function reach(_options: ReachOptions): Promise<ReachResult> {
  // TODO: fetch job and company from SQLite
  // TODO: search for HR contacts via Apify LinkedIn people search
  // TODO: infer email from Company.domain if not found
  // TODO: call Claude API to draft personalized cold email
  // TODO: write draft to .md file
  // TODO: if send=true, send via Gmail API after confirmation
  // TODO: update job record with outreachDraftPath
  throw new Error('Not implemented');
}
