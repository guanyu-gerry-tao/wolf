/**
 * Strips user-only annotation blocks from a markdown string before it is
 * passed to an AI prompt.
 *
 * The convention: a "user-only block" is a GitHub-Alert-style blockquote that
 * starts with `> [!XYZ]` (where XYZ is any identifier — TIP, IMPORTANT, NOTE,
 * WARNING, CAUTION, or any custom tag). Every consecutive `>`-prefixed line
 * after that header is part of the same block. The block ends at the first
 * non-`>` line (a blank line or any non-blockquote content).
 *
 * Plain `>` blockquotes WITHOUT an alert head are NOT stripped — they are
 * legitimate markdown content (quoting an interview question, an email, a
 * paper excerpt, etc.) and reach the AI normally.
 *
 * Convention used in wolf templates:
 *   - `> [!TIP]`       — default user-only annotation (most common)
 *   - `> [!IMPORTANT]` — REQUIRED markers (the user MUST answer this field)
 *   - `> [!WARNING]` / `> [!CAUTION]` — special cases (rare)
 *   - `> [!NOTE]`      — rarely used
 *
 * Example input:
 *
 *   > [!IMPORTANT]
 *   > You must answer this; AI cannot guess.
 *   > Even more notes.
 *
 *   The recruiter wrote:
 *   > Why are you interested in our XYZ product?
 *
 *   I'd respond ...
 *
 * After stripping:
 *
 *   The recruiter wrote:
 *   > Why are you interested in our XYZ product?
 *
 *   I'd respond ...
 *
 * The alert block is gone; the recruiter quote stays.
 */
const ALERT_HEAD = /^\s*>\s*\[!\w+\]/;
const BLOCKQUOTE = /^\s*>/;

export function stripComments(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inAlertBlock = false;

  for (const line of lines) {
    if (inAlertBlock) {
      if (BLOCKQUOTE.test(line)) {
        // Continuation line of the alert block — strip.
        continue;
      }
      // Non-blockquote line ends the alert block. Fall through to handle
      // this line normally.
      inAlertBlock = false;
    }

    if (ALERT_HEAD.test(line)) {
      // Start of a new alert block — strip the head, enter strip mode.
      inAlertBlock = true;
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}
