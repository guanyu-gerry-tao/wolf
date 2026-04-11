import type { ReachOptions, ReachResult } from '../../types/index.js';

/**
 * Finds HR contacts and drafts an outreach email for a job.
 *
 * Output: both an `.eml` file (double-click to open in system mail client)
 * and a `.md` file (pastable into Gmail web UI or LinkedIn InMail).
 * wolf does NOT send — the user stays in control of the send action.
 *
 * No OAuth, no Gmail API, no credentials directory.
 */
export async function reach(_options: ReachOptions): Promise<ReachResult> {
  // TODO(M5): const ctx = createAppContext();
  // TODO(M5): return ctx.reachApp.runPipeline(options);
  // TODO(M5): reachApp composes:
  //           - contactService.findContacts() (via provider)
  //           - emailService.draftEmail() (Claude API — or mock)
  //           - emailService.writeEml()       → .eml file
  //           - emailService.writePastable()  → .md file
  //           Persists outreachDraftPath via jobRepository
  throw new Error('Not implemented');
}
