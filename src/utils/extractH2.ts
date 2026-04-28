/**
 * Tiny markdown helper: extract the body content of a level-2 (`## Title`)
 * section from a markdown string. Used by `wolf tailor` and other commands
 * that need a specific field out of `profile.md` (which the user authors
 * as `H1 = category, H2 = field, body = answer` per the wolf convention).
 *
 * "Body" = every line between the matching `## Title` line and the next H1
 * or H2, with surrounding whitespace trimmed. Returns empty string when the
 * section is missing or the body is empty/blank.
 *
 * The caller is responsible for stripping `> [!XYZ]` alert blocks beforehand
 * (via `stripComments`) if it wants the post-strip user content.
 *
 * Match is exact on the title text after the `## ` prefix (case-sensitive,
 * leading/trailing whitespace tolerated). Multiple H2s with the same title
 * resolve to the FIRST one — the convention is that fields appear once.
 */
export function extractH2Content(md: string, title: string): string {
  const want = title.trim();
  const lines = md.split('\n');
  let i = 0;

  // Walk to the matching ## Title line.
  while (i < lines.length) {
    const m = /^##\s+(.*)$/.exec(lines[i]);
    if (m && m[1].trim() === want) break;
    i++;
  }
  if (i >= lines.length) return '';

  // Collect everything until the next H1 or H2.
  i++;
  const body: string[] = [];
  while (i < lines.length) {
    if (/^#{1,2}\s/.test(lines[i])) break;
    body.push(lines[i]);
    i++;
  }
  return body.join('\n').trim();
}
