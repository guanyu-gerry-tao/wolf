import type { ReachOptions, ReachResult } from '../utils/types/index.js';

/**
 * Use case for `wolf reach` (Milestone 5) — finds HR contacts for a job and
 * drafts an outreach email. Output is two files: a `.eml` (double-clickable
 * into the system mail client) and a `.md` (pastable into Gmail web or
 * LinkedIn InMail). **wolf does NOT send** — the user keeps send authority.
 *
 * Currently a stub; the full pipeline lands in M5.
 */
export interface ReachApplicationService {
  /**
   * Resolves contacts via the configured provider, drafts the email body
   * with Claude, writes both file shapes, persists `outreachDraftPath`
   * back to the job row.
   */
  reach(options: ReachOptions): Promise<ReachResult>;
}
