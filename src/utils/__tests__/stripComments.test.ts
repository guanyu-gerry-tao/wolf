import { describe, it, expect } from 'vitest';
import { stripComments } from '../stripComments.js';

// stripComments has TWO modes selected via `dropEmptyH2s`. There is NO
// default — every call site must spell out which mode it wants. These
// suites exercise both modes and pin down the contract for each.

describe('stripComments({ dropEmptyH2s: false }) — alert-strip-only mode', () => {
  // No alert blocks → unchanged.
  it('returns text unchanged when there are no alert blocks', () => {
    const input = '## Experience\n- Built something\n\n## Skills\nTypeScript';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe(input);
  });

  // A plain blockquote without an alert head is real markdown content
  // (the user quoting an interview question, an email, a paper, etc.).
  // It must survive — only `> [!XYZ]` blocks are stripped.
  it('preserves plain > blockquotes (no alert head)', () => {
    const input = 'The recruiter wrote:\n> Why are you interested in our product?\n\nI responded that ...';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe(input);
  });

  // GitHub Alert block: head + continuation lines all stripped.
  it('strips a > [!IMPORTANT] block (head + body)', () => {
    const input = '> [!IMPORTANT]\n> You must answer this.\n## Field\nvalue';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe('## Field\nvalue');
  });

  // The default tag for user notes in wolf templates is [!TIP]; verify it strips.
  it('strips a > [!TIP] block', () => {
    const input = '> [!TIP]\n> Defaults to United States; edit if abroad.\nUnited States';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe('United States');
  });

  // Any [!XYZ] tag works: TIP / IMPORTANT / NOTE / WARNING / CAUTION / custom.
  it('strips any > [!XYZ] alert block, regardless of tag', () => {
    const input = '> [!NOTE]\n> note body\nReal A\n> [!WARNING]\n> warn body\nReal B\n> [!CAUTION]\n> caution body\nReal C';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe('Real A\nReal B\nReal C');
  });

  // The alert block ends at the first non-blockquote line. A subsequent plain
  // `>` line (separated by content) is NOT part of any alert block — so it stays.
  it('ends the alert block at the first non-blockquote line; plain > after stays', () => {
    const input = '> [!TIP]\n> first body\n> second body\nactual content\n> separate quote';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe('actual content\n> separate quote');
  });

  // Adjacent alert blocks separated by a blank line are stripped independently.
  it('strips two adjacent alert blocks separated by a blank line', () => {
    const input = '> [!TIP]\n> first block\n\n> [!TIP]\n> second block\n\nreal content';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe('\n\nreal content');
  });

  // A line containing > mid-content (e.g. `if x > 5`) must not trigger anything.
  it('does not strip lines that contain > but do not start with >', () => {
    const input = 'if x > 5: do_thing()\nmore code';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe(input);
  });

  // Indented alert head still counts as an alert (rare but possible from copy-paste).
  it('strips an indented > [!IMPORTANT] block', () => {
    const input = '  > [!IMPORTANT]\n  > body line\n## Header';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe('## Header');
  });

  // A `>` continuation line after the alert head with mid-body `[!XYZ]` does
  // NOT start a new block — it's still continuation. The whole block stays gone.
  it('treats every > after the head as continuation, regardless of content', () => {
    const input = '> [!TIP]\n> body referencing [!IMPORTANT] inline\n> still continuation\nreal';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe('real');
  });

  // The legacy `//` marker is no longer special — those lines reach the AI.
  it('does NOT strip lines that start with // (legacy marker is inert now)', () => {
    const input = '// this is a JS-style code-sample comment\n## Header';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe(input);
  });

  // Empty string → empty string.
  it('handles empty string', () => {
    expect(stripComments('', { dropEmptyH2s: false })).toBe('');
  });

  // Alert block at end-of-file (no trailing non-blockquote line) is still stripped.
  it('strips an alert block that runs to end-of-file', () => {
    const input = 'real content\n> [!TIP]\n> trailing tip body';
    expect(stripComments(input, { dropEmptyH2s: false })).toBe('real content');
  });

  // The doctor/assertReadyForTailor path needs empty H2s preserved so it
  // can detect "Email is REQUIRED but body is empty" via extractH2Content.
  // This mode must NOT drop empty H2 sections.
  it('preserves empty H2 sections (doctor path needs them to detect missing fields)', () => {
    const input = '## Email\n\n## Phone\ngerry@example.com\n## LinkedIn\n';
    // After alert strip (no alerts here): unchanged.
    expect(stripComments(input, { dropEmptyH2s: false })).toBe(input);
  });
});

describe('stripComments({ dropEmptyH2s: true }) — AI-prompt mode', () => {
  // Same alert-stripping behaviour applies — verify it still runs.
  it('still strips alert blocks (alert-strip phase runs in both modes)', () => {
    const input = '## Email\ngerry@example.com\n> [!TIP]\n> tip body';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe('## Email\ngerry@example.com');
  });

  // Core new behaviour: H2 with empty body is dropped entirely (heading + body).
  it('drops an H2 whose body is blank lines only', () => {
    const input = '## Email\ngerry@example.com\n\n## Phone\n\n\n## LinkedIn\nlinkedin.com/x';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe('## Email\ngerry@example.com\n\n## LinkedIn\nlinkedin.com/x');
  });

  // After alert blocks are stripped, an H2 whose ONLY body was the alert
  // becomes effectively empty — and must be dropped.
  it('drops an H2 that contained only an alert block (the template-unfilled case)', () => {
    const input = '## Email\nme@x.com\n\n## Phone\n> [!IMPORTANT]\n> REQUIRED — fill this.\n\n## City\nSF';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe('## Email\nme@x.com\n\n## City\nSF');
  });

  // Stray noise content in a body does not count as filled — empty bullets,
  // dividers, and HTML comments are skipped by isMeaningfulLine. Whatever
  // blank line lived inside Filled's own body is preserved (one trailing \n
  // from line 2 of the input); trailing blank lines that lived inside the
  // dropped sections disappear with them.
  it('treats empty bullets, dividers, and HTML comments as empty', () => {
    const input = '## Filled\nreal content\n\n## EmptyBullet\n- \n\n## Divider\n---\n\n## Comment\n<!-- todo -->';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe('## Filled\nreal content\n');
  });

  // A bullet WITH text is meaningful and the section stays.
  it('keeps an H2 whose body has a real bullet', () => {
    const input = '## Skills\n- TypeScript\n- Go';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe(input);
  });

  // H1 headings are never dropped — only H2.
  it('does not drop H1 headings, even with empty body', () => {
    const input = '# Identity\n\n## Email\ngerry@example.com';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe(input);
  });

  // H3+ subsections live UNDER their parent H2. If any H3 (or its body)
  // has meaningful content, the whole parent H2 is kept along with it.
  // Used in standard_questions.md "## What docs do you have? / ### Transcript / file.pdf" shape.
  it('keeps an H2 when an H3 child has content (H3 belongs to the H2 section)', () => {
    const input = '## Documents\n### Transcript\nfile.pdf';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe(input);
  });

  // Mirror case: H2 with multiple H3 children, some empty some filled —
  // as long as ANY descendant has content, the H2 is filled.
  it('keeps an H2 with mixed-content H3 children', () => {
    const input = '## Documents\n### Transcript\n\n### Cover\nfile.pdf';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe(input);
  });

  // The opposite: H2 with an empty H3 (heading only, no body) — H3 line
  // is structural, not content, so the H2 is empty and dropped along
  // with its empty H3 child.
  it('drops an H2 whose only H3 child is itself empty', () => {
    const input = '## Filled\nyes\n## Documents\n### Transcript\n## Other\nx';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe('## Filled\nyes\n## Other\nx');
  });

  // An H2 at end-of-file with no body is dropped. The trailing newline
  // that "belonged" to ## Empty disappears with it — that is correct,
  // because that newline was structurally part of the empty section.
  it('drops an empty H2 at end-of-file (and its trailing newline)', () => {
    const input = '## Filled\nyes\n## Empty\n';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe('## Filled\nyes');
  });

  // REGRESSION — earlier draft of dropEmptyH2Sections terminated the H2
  // body at the FIRST heading of any level, which meant an H3 line was
  // treated as the end of the H2's body. A standard_questions.md section
  // like:
  //
  //   ## What academic documents do you have?
  //   ### Transcript
  //   transcript.pdf
  //
  // was wrongly classified as "empty H2" because the body span (## .. ###)
  // contained nothing meaningful. The H2 got dropped, orphaning the H3.
  // Fixed by extending H2 body until the next H1/H2 (not the next H3+),
  // so H3 subsections count as part of the parent H2's content.
  it('REGRESSION: H2 with H3 children + nested content is NOT classified as empty', () => {
    const input = '## What academic documents do you have?\n### Transcript\ntranscript.pdf\n## Other\nfoo';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe(input);
  });

  // REGRESSION (companion case) — an H2 followed only by EMPTY H3 children
  // (heading lines without body) IS empty: H3 lines are structural, not
  // content, and isMeaningfulLine excludes all heading levels. The H2 +
  // its empty H3 children all drop together.
  it('REGRESSION: H2 followed only by empty H3 children IS classified as empty', () => {
    const input = '## Filled\nyes\n## Documents\n### Transcript\n### Cover\n## Other\nx';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe('## Filled\nyes\n## Other\nx');
  });

  // Empty string → empty string (boundary case).
  it('handles empty string', () => {
    expect(stripComments('', { dropEmptyH2s: true })).toBe('');
  });

  // No H2s at all → output equals alert-stripped input (drop phase is a no-op).
  it('is identity on text with no H2 headings', () => {
    const input = '# Title\n\nsome paragraph\nmore lines';
    expect(stripComments(input, { dropEmptyH2s: true })).toBe(input);
  });
});
