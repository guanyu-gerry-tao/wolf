/**
 * Strips user-only annotation blocks from a markdown string before it is
 * passed to an AI prompt OR examined by structural validators (doctor,
 * `assertReadyForTailor`).
 *
 * # Two modes — pick deliberately at every call site
 *
 * `stripComments` has NO default for `dropEmptyH2s`. Every caller must
 * spell out which mode they want, because the wrong mode silently produces
 * misleading output:
 *
 *   stripComments(md, { dropEmptyH2s: false })
 *     - Strips only `> [!XYZ]` alert blocks.
 *     - Preserves the full H2 skeleton, including H2s whose body is now
 *       blank (the user hasn't filled them in yet).
 *     - Use this for **doctor / `assertReadyForTailor` / any structural
 *       check** that needs to know "which REQUIRED H2 is still empty".
 *       `extractH2Content('Email')` returning `[]` is the signal that the
 *       user must fill it in.
 *
 *   stripComments(md, { dropEmptyH2s: true })
 *     - Strips alert blocks AND drops any `## H2` whose body (after alert
 *       removal) contains no non-whitespace content. The H2 line itself
 *       is removed along with its (empty) body.
 *     - "Empty" means: every line between this H2 and the next heading is
 *       blank or whitespace-only. Stray bullets (`-`, `*`), dividers
 *       (`---`), and HTML comments (`<!-- ... -->`) also count as empty.
 *     - Use this for **AI prompt feeds** (analyst brief, resume writer,
 *       cover-letter writer, hint.md, anywhere profile/resume_pool content
 *       is concatenated into a model prompt). Hides unanswered optional
 *       sections so the AI does not try to fabricate content for them and
 *       does not see the word "optional" attached to a heading. The
 *       "OPTIONAL" / "REQUIRED" hints live inside the alert body, which is
 *       always stripped — so the AI sees only filled sections, with no
 *       skip-or-fill signals attached.
 *
 * # Alert block grammar (applies in BOTH modes)
 *
 * A "user-only block" is a GitHub-Alert-style blockquote that starts with
 * `> [!XYZ]` (where XYZ is any identifier — TIP, IMPORTANT, NOTE,
 * WARNING, CAUTION, or any custom tag). Every consecutive `>`-prefixed
 * line after that header is part of the same block. The block ends at
 * the first non-`>` line (a blank line or any non-blockquote content).
 *
 * Plain `>` blockquotes WITHOUT an alert head are NOT stripped — they
 * are legitimate markdown content (quoting an interview question, an
 * email, a paper excerpt, etc.) and reach the AI normally.
 *
 * Convention used in wolf templates:
 *   - `> [!IMPORTANT]` — REQUIRED markers (the user MUST answer this field)
 *   - `> [!NOTE]` / `> [!TIP]` — OPTIONAL guidance / examples
 *   - `> [!WARNING]` / `> [!CAUTION]` — special cases (rare)
 *
 * Example input:
 *
 *   ## Email
 *   gerry@example.com
 *
 *   > [!IMPORTANT]
 *   > REQUIRED — Wolf cannot guess this.
 *
 *   ## Phone
 *
 *   > [!IMPORTANT]
 *   > REQUIRED — used for outreach.
 *
 *   ## LinkedIn
 *
 *   > [!NOTE]
 *   > OPTIONAL — boosts outreach.
 *
 * `stripComments(md, { dropEmptyH2s: false })`:
 *
 *   ## Email
 *   gerry@example.com
 *
 *   ## Phone
 *
 *   ## LinkedIn
 *
 * `stripComments(md, { dropEmptyH2s: true })`:
 *
 *   ## Email
 *   gerry@example.com
 *
 * Note how the second form completely hides the unfilled `## Phone` and
 * `## LinkedIn` sections — that is the point.
 */

export interface StripCommentsOptions {
  /**
   * REQUIRED — no default. Pick deliberately:
   *   - `true`  for AI prompt feeds (hide unanswered sections so the model
   *             does not fabricate or see "optional" hints).
   *   - `false` for structural checks (doctor, `assertReadyForTailor`)
   *             that need to detect which REQUIRED H2 is still empty.
   * See module-level JSDoc for the full rationale.
   */
  dropEmptyH2s: boolean;
}

const ALERT_HEAD = /^\s*>\s*\[!\w+\]/;
const BLOCKQUOTE = /^\s*>/;
const H2_HEADING = /^##\s+/;
// H2 body extends until the next H1 or H2 (NOT next H3+) — H3 subsections
// belong to their parent H2 and contribute to whether the H2 is "filled".
const H1_OR_H2_HEADING = /^#{1,2}\s+/;
const HEADING_ANY = /^#{1,6}\s+/;

export function stripComments(text: string, options: StripCommentsOptions): string {
  const afterAlertStrip = stripAlertBlocks(text);
  if (!options.dropEmptyH2s) {
    return afterAlertStrip;
  }
  return dropEmptyH2Sections(afterAlertStrip);
}

// Phase 1 — strip `> [!XYZ]` alert blocks (head + continuation lines).
function stripAlertBlocks(text: string): string {
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

// Phase 2 — drop any `## H2` whose body (everything until the next heading
// of any level) has no non-whitespace, non-noise content. H1, H3+, and
// non-empty H2 sections are preserved untouched.
function dropEmptyH2Sections(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!H2_HEADING.test(line)) {
      out.push(line);
      i++;
      continue;
    }

    // Scan from the line after this H2 to the next H1/H2 or end-of-file.
    // H3+ subsections belong to this H2 — if they contain content, the
    // parent H2 is considered filled (and kept). Only nesting-equal-or-
    // higher headings terminate the section.
    const bodyStart = i + 1;
    let bodyEnd = bodyStart;
    while (bodyEnd < lines.length && !H1_OR_H2_HEADING.test(lines[bodyEnd])) {
      bodyEnd++;
    }

    const bodyHasContent = lines
      .slice(bodyStart, bodyEnd)
      .some((bodyLine) => isMeaningfulLine(bodyLine));

    if (bodyHasContent) {
      // Keep H2 + body untouched.
      for (let j = i; j < bodyEnd; j++) {
        out.push(lines[j]);
      }
    }
    // else: drop H2 + body entirely.
    i = bodyEnd;
  }

  return out.join('\n');
}

// A line counts as "meaningful" body content if it survives whitespace +
// structural-noise filters. The intent: AI must not see a section just
// because the user (or AI) left a stray bullet, divider, or HTML comment
// in the body. Only real text counts.
function isMeaningfulLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  // Heading line (any level) — structural, not content. An H2 whose only
  // "body" is an empty H3 still counts as empty.
  if (HEADING_ANY.test(trimmed)) return false;
  // Empty list bullet ("- ", "* ", "+ ") with no body — noise.
  if (/^[-*+]\s*$/.test(trimmed)) return false;
  // Horizontal rule.
  if (/^-{3,}$|^\*{3,}$|^_{3,}$/.test(trimmed)) return false;
  // HTML comment-only line (single-line). Multi-line comments still pass
  // through if they have visible text — we are not parsing HTML.
  if (/^<!--.*-->$/.test(trimmed)) return false;
  return true;
}
