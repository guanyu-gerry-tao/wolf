/**
 * Surgical TOML editing — replaces a single field's value in-place on the
 * raw TOML string, preserving comments, blank lines, and other fields.
 *
 * # Why not parse → modify → stringify
 *
 * smol-toml (the parser wolf already depends on) does NOT support
 * comment-preserving roundtrip — its `stringify` rebuilds the document
 * from scratch and drops every `#` line. profile.toml's comments are
 * NOT noise: every field carries an inline `# REQUIRED — ...` /
 * `# OPTIONAL — ...` block that the user reads while editing the file
 * by hand. Losing them on every `wolf profile set` would be a UX
 * regression severe enough to abandon TOML entirely.
 *
 * Surgical string editing skips that whole problem: we leave 99% of the
 * file untouched and rewrite only the bytes between the `"""` quotes
 * (or after the `=`, for booleans).
 *
 * # What's supported
 *
 *   - Multiline string fields under a top-level table:
 *     `setMultilineString(content, 'identity', 'email', 'a@b')`
 *
 *   - Multiline string fields on a member of an array-of-tables, located
 *     by `id`:
 *     `setMultilineStringInArrayMember(content, 'experience', 'amazon-2024', 'bullets', '- ...')`
 *
 *   - Booleans (story.required is the only one in scope right now):
 *     `setBooleanInArrayMember(content, 'story', '<id>', 'required', true)`
 *
 * # What's NOT supported
 *
 *   - Adding or removing array members. wolf profile add/remove handles
 *     those by appending/deleting whole `[[<type>]]` blocks — see
 *     addArrayMember / removeArrayMember below for the helpers.
 *
 *   - Numeric fields. profile.toml currently only has `schemaVersion`
 *     at top level (managed by the migration runtime, not wolf set).
 *
 *   - Inline-table fields. profile.toml uses `[[type]]` array-of-table
 *     syntax exclusively for repeated structures.
 *
 * # Failure modes & contract
 *
 *   - **`"""` in the value itself** (e.g. user pastes a Python docstring
 *     example): we reject at the input boundary. The CLI surfaces
 *     "value contains triple-quote; use --from-file" so the agent
 *     re-tries via a file path.
 *
 *   - **Commented-out template stubs** (e.g. the `# [[experience]]`
 *     example block that ships uncommented as a guide): the algorithm
 *     scans for `[[<type>]]` only on lines NOT starting with `#`. So a
 *     stub block doesn't count as a real array member.
 *
 *   - **Comment-prefixed field lookalikes** (e.g. inside a multiline
 *     string body that happens to contain text like `email = """`):
 *     irrelevant. We only match field declarations at the BEGINNING of
 *     a logical line in the table's section.
 */

/** Common error class so the CLI can render a clean banner. */
export class TomlEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TomlEditError';
  }
}

/** Reject values that would break the surgical algorithm. */
function assertValueIsSafe(value: string): void {
  if (value.includes('"""')) {
    throw new TomlEditError(
      'Value contains triple-quote (""") which would break TOML multiline ' +
      'string termination. Pass the value via `--from-file <path>` instead.',
    );
  }
}

/** Helper: regex-escape a literal segment so it can sit inside a built RegExp. */
function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Top-level table.field edits
// ---------------------------------------------------------------------------

/**
 * Replaces the value of a multiline-string field on a top-level table.
 *
 * Locates the bytes between the field's opening `"""` and the matching
 * closing `"""`, swaps them for `\n<newValue>\n`. Adjacent fields,
 * comments, and blank lines stay untouched.
 *
 * Throws `TomlEditError` if:
 *   - The table header `[<table>]` isn't found.
 *   - The field declaration `<field> = """` isn't found inside the table.
 *   - The closing `"""` can't be located (TOML file is malformed).
 *   - The new value contains `"""` (would break TOML termination).
 */
export function setMultilineString(
  content: string,
  table: string,
  field: string,
  newValue: string,
): string {
  assertValueIsSafe(newValue);

  const tableRange = findTopLevelTableRange(content, table);
  if (!tableRange) {
    throw new TomlEditError(`Table [${table}] not found in TOML.`);
  }

  const fieldRange = findMultilineFieldRange(
    content,
    field,
    tableRange.bodyStart,
    tableRange.bodyEnd,
  );
  if (!fieldRange) {
    throw new TomlEditError(`Field ${table}.${field} not found.`);
  }

  return spliceValue(content, fieldRange, newValue);
}

/**
 * Replaces a boolean field on a top-level table. Accepts only `true` /
 * `false` literal output — we never quote-wrap booleans into strings.
 */
export function setBoolean(
  content: string,
  table: string,
  field: string,
  value: boolean,
): string {
  const tableRange = findTopLevelTableRange(content, table);
  if (!tableRange) {
    throw new TomlEditError(`Table [${table}] not found in TOML.`);
  }

  const fieldRange = findScalarFieldRange(
    content,
    field,
    tableRange.bodyStart,
    tableRange.bodyEnd,
  );
  if (!fieldRange) {
    throw new TomlEditError(`Field ${table}.${field} not found.`);
  }

  return spliceScalar(content, fieldRange, value ? 'true' : 'false');
}

// ---------------------------------------------------------------------------
// Array-of-table member field edits
// ---------------------------------------------------------------------------

/**
 * Replaces a multiline string field on an array-of-table member located
 * by `id`. E.g. `setMultilineStringInArrayMember(toml, 'experience',
 * 'amazon-2024', 'bullets', '- Reduced API latency 40%')` finds the
 * `[[experience]]` block whose `id = "amazon-2024"` and rewrites its
 * `bullets = """..."""` value.
 */
export function setMultilineStringInArrayMember(
  content: string,
  arrayName: string,
  id: string,
  field: string,
  newValue: string,
): string {
  assertValueIsSafe(newValue);
  if (field === 'id') {
    throw new TomlEditError(
      `Cannot rename '${arrayName}.${id}.id' via wolf profile set. ` +
      `Remove the entry and re-add it with the new id instead.`,
    );
  }

  const memberRange = findArrayMemberRange(content, arrayName, id);
  if (!memberRange) {
    throw new TomlEditError(`Array member ${arrayName}.${id} not found.`);
  }

  const fieldRange = findMultilineFieldRange(
    content,
    field,
    memberRange.bodyStart,
    memberRange.bodyEnd,
  );
  if (!fieldRange) {
    throw new TomlEditError(`Field ${arrayName}.${id}.${field} not found.`);
  }

  return spliceValue(content, fieldRange, newValue);
}

/** Replaces a boolean field on an array-of-table member located by id. */
export function setBooleanInArrayMember(
  content: string,
  arrayName: string,
  id: string,
  field: string,
  value: boolean,
): string {
  const memberRange = findArrayMemberRange(content, arrayName, id);
  if (!memberRange) {
    throw new TomlEditError(`Array member ${arrayName}.${id} not found.`);
  }

  const fieldRange = findScalarFieldRange(
    content,
    field,
    memberRange.bodyStart,
    memberRange.bodyEnd,
  );
  if (!fieldRange) {
    throw new TomlEditError(`Field ${arrayName}.${id}.${field} not found.`);
  }

  return spliceScalar(content, fieldRange, value ? 'true' : 'false');
}

// ---------------------------------------------------------------------------
// Add / remove array members
// ---------------------------------------------------------------------------

/**
 * Appends a new `[[<arrayName>]]` block to the end of the file. Caller
 * supplies the full block body as a string (including the `[[arrayName]]`
 * header line and all field lines). The runner doesn't try to be clever
 * about insertion order — appending at EOF is unambiguous and makes
 * stable text diffs.
 *
 * Returns the new content with the block appended (preceded by a blank
 * line if not already terminated by one).
 */
export function appendArrayMember(content: string, blockText: string): string {
  // Ensure exactly one blank line between the existing content and the new
  // block. This handles both EOF-no-newline and EOF-with-multiple-newlines.
  const trimmedEnd = content.replace(/\n+$/, '');
  const needsLeadingBlank = trimmedEnd.length > 0;
  const block = blockText.startsWith('\n') ? blockText : '\n' + blockText;
  const finalBlock = block.endsWith('\n') ? block : block + '\n';
  return trimmedEnd + (needsLeadingBlank ? '\n' : '') + finalBlock;
}

/**
 * Removes the entire `[[<arrayName>]]` block whose `id = "<id>"`. Returns
 * the new content. Trailing blank line(s) belonging to the removed block
 * are absorbed so the file doesn't grow ragged after multiple removes.
 *
 * Throws if no such member exists — the CLI translates that into "no such
 * entry" rather than silently no-op.
 */
export function removeArrayMember(content: string, arrayName: string, id: string): string {
  const range = findArrayMemberRange(content, arrayName, id);
  if (!range) {
    throw new TomlEditError(`Array member ${arrayName}.${id} not found.`);
  }
  // Extend the deletion to swallow up to one leading blank line and any
  // trailing blank lines so we don't leave a vacuum in the document.
  const before = content.slice(0, range.headerStart).replace(/\n\n+$/, '\n');
  const after = content.slice(range.bodyEnd).replace(/^\n+/, '\n');
  return before + after;
}

// ---------------------------------------------------------------------------
// Internal: range-finding helpers
// ---------------------------------------------------------------------------

interface TableRange {
  /** Index of the `[<table>]` header line's first character. */
  headerStart: number;
  /** Index just after the header line (start of the table body). */
  bodyStart: number;
  /** Index just before the next table header, or `content.length`. */
  bodyEnd: number;
}

/**
 * Locates a top-level `[<table>]` header (NOT `[[<table>]]` array-of-table)
 * and returns the index range of its body. Skips any `[<table>]` text that
 * appears inside a comment line.
 */
function findTopLevelTableRange(content: string, table: string): TableRange | null {
  const escaped = escapeRegex(table);
  // ^[ \t]* ensures we match start-of-line; (?<!\[) excludes [[<table>]].
  const headerRe = new RegExp(`^[ \\t]*\\[${escaped}\\][ \\t]*$`, 'm');
  const match = locateMatchOutsideStrings(content, headerRe, /* commentSensitive */ true);
  if (!match) return null;

  const headerStart = match.index;
  const bodyStart = match.index + match[0].length + 1; // skip header + newline
  const bodyEnd = findNextTableOrEnd(content, bodyStart);
  return { headerStart, bodyStart, bodyEnd };
}

interface ArrayMemberRange {
  /** Start index of the `[[<arrayName>]]` header line. */
  headerStart: number;
  /** Start of the member's body (just after the header line). */
  bodyStart: number;
  /** Index just before the next table/array header, or `content.length`. */
  bodyEnd: number;
}

/**
 * Locates the `[[<arrayName>]]` member whose `id = "<id>"` (single-line
 * id, since wolf-generated ids are slug strings). Comment lines are
 * ignored so commented-out template stubs don't false-positive.
 */
function findArrayMemberRange(content: string, arrayName: string, id: string): ArrayMemberRange | null {
  const escapedArray = escapeRegex(arrayName);
  // Match `[[<arrayName>]]` at start of line (skipping leading whitespace).
  const headerRe = new RegExp(`^[ \\t]*\\[\\[${escapedArray}\\]\\][ \\t]*$`, 'gm');

  // Walk all `[[<arrayName>]]` headers, looking for the one whose body
  // contains the matching `id = "<id>"` line. We need to walk because
  // arrayName headers repeat naturally.
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(content)) !== null) {
    if (isInCommentLine(content, m.index)) continue;
    const bodyStart = m.index + m[0].length + 1;
    const bodyEnd = findNextTableOrEnd(content, bodyStart);
    if (bodyContainsIdAssignment(content.slice(bodyStart, bodyEnd), id)) {
      return { headerStart: m.index, bodyStart, bodyEnd };
    }
  }
  return null;
}

/** True if the body text contains a `id = "<id>"` assignment line. */
function bodyContainsIdAssignment(body: string, id: string): boolean {
  // Single-quoted, double-quoted, and bare-key-style values all accepted.
  // Keep the regex anchored at line-start to avoid matching `id = "..."`
  // text that happens to live inside a multiline string body. (A multiline
  // string's continuation lines aren't at line-start UNLESS the user
  // pastes content that happens to look like `id = "..."` — accept that
  // small risk for now since wolf-generated ids are unique slugs.)
  const escapedId = escapeRegex(id);
  const re = new RegExp(`^[ \\t]*id[ \\t]*=[ \\t]*["']${escapedId}["'][ \\t]*$`, 'm');
  return re.test(body);
}

interface FieldRange {
  /** Index of the byte just after the opening `"""`. */
  valueStart: number;
  /** Index of the closing `"""` byte. */
  valueEnd: number;
}

/**
 * Locates a `<field> = """ ... """` declaration inside the byte range
 * [start, end). Returns the byte range of the value (between the two
 * `"""` markers).
 */
function findMultilineFieldRange(
  content: string,
  field: string,
  start: number,
  end: number,
): FieldRange | null {
  const escapedField = escapeRegex(field);
  // Match `<field> = """` at the START of a logical line. Anchored to
  // start-of-line via the `m` flag so we don't accidentally match a
  // commented-out `# field = """` line.
  const re = new RegExp(`^[ \\t]*${escapedField}[ \\t]*=[ \\t]*"""[ \\t]*$`, 'gm');
  re.lastIndex = start;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index >= end) return null;
    if (isInCommentLine(content, m.index)) continue;
    const valueStart = m.index + m[0].length;
    // Find the closing `"""` AFTER the opening triple-quote line.
    const closeRel = content.indexOf('"""', valueStart + 1);
    if (closeRel === -1 || closeRel >= end) {
      throw new TomlEditError(`Unclosed multiline string for field '${field}'.`);
    }
    return { valueStart, valueEnd: closeRel };
  }
  return null;
}

interface ScalarFieldRange {
  /** Index of the start of the value (right after the `=` and any whitespace). */
  valueStart: number;
  /** Index just past the end of the line (newline or EOF). */
  valueEnd: number;
}

/** Locates a scalar field assignment `<field> = <something>` (whole-line). */
function findScalarFieldRange(
  content: string,
  field: string,
  start: number,
  end: number,
): ScalarFieldRange | null {
  const escapedField = escapeRegex(field);
  // Capture group 1 is the leading whitespace + name + `=` + leading value
  // whitespace, so we can compute the value's start byte. The actual value
  // can be true / false / a number / a quoted string — we don't validate
  // here (callers narrow by writing only their expected type).
  const re = new RegExp(`^([ \\t]*${escapedField}[ \\t]*=[ \\t]*)`, 'gm');
  re.lastIndex = start;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index >= end) return null;
    if (isInCommentLine(content, m.index)) continue;
    const valueStart = m.index + m[1].length;
    // Find end-of-line (or EOF) for the value range.
    const newlineIdx = content.indexOf('\n', valueStart);
    const valueEnd = newlineIdx === -1 ? content.length : newlineIdx;
    return { valueStart, valueEnd };
  }
  return null;
}

/**
 * Returns the byte index of the next `[<table>]` or `[[<table>]]` header
 * line at-or-after `from`, or `content.length` if none found. Skips
 * commented-out lookalikes.
 */
function findNextTableOrEnd(content: string, from: number): number {
  const re = /^[ \t]*\[\[?[A-Za-z_][A-Za-z0-9_-]*\]\]?[ \t]*$/gm;
  re.lastIndex = from;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (isInCommentLine(content, m.index)) continue;
    return m.index;
  }
  return content.length;
}

/**
 * True if the byte at index `idx` lies on a line whose first non-whitespace
 * character is `#` (a comment line). This prevents matching template stubs
 * like `# [[experience]]` / `# field = """`.
 */
function isInCommentLine(content: string, idx: number): boolean {
  // Walk backward from idx until we find a newline or BOF.
  let i = idx;
  while (i > 0 && content[i - 1] !== '\n') i--;
  // Now [i, idx] is the line up to the match. Find the first non-WS char.
  while (i < content.length && (content[i] === ' ' || content[i] === '\t')) i++;
  return content[i] === '#';
}

/**
 * Generic "match this regex but skip results that are inside a comment
 * line" helper. The regex MUST have the `m` flag so `^` anchors to line
 * starts. Returns the first non-comment match or null.
 */
function locateMatchOutsideStrings(
  content: string,
  re: RegExp,
  commentSensitive: boolean,
): RegExpExecArray | null {
  // Clone the regex with the `g` flag so we can iterate matches.
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const iter = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = iter.exec(content)) !== null) {
    if (commentSensitive && isInCommentLine(content, m.index)) continue;
    return m;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal: splicing
// ---------------------------------------------------------------------------

/** Replaces a multiline string value with `\n<newValue>\n` (TOML-canonical shape). */
function spliceValue(content: string, range: FieldRange, newValue: string): string {
  const before = content.slice(0, range.valueStart);
  const after = content.slice(range.valueEnd);
  // The opening `"""` is followed by a newline (TOML multiline starts on the
  // next line by convention). We re-emit `\n<value>\n` so the closing `"""`
  // also sits at column 0.
  return before + '\n' + newValue + '\n' + after;
}

/** Replaces a scalar value with the given literal text. */
function spliceScalar(content: string, range: ScalarFieldRange, newLiteral: string): string {
  const before = content.slice(0, range.valueStart);
  const after = content.slice(range.valueEnd);
  return before + newLiteral + after;
}
