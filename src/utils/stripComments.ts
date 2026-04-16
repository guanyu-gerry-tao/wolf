/**
 * Strips single-line comments from a markdown string before it is passed to an
 * AI prompt. Any line whose first non-whitespace characters are `//` is removed.
 *
 * This lets template files (e.g. resume_pool.md) carry human-readable
 * instructions without leaking them into the prompt.
 *
 * Example:
 *   // This note is for the user only — never sent to the AI.
 *   ## Experience
 *   ...
 */
export function stripComments(text: string): string {
  return text
    .split('\n')
    .filter(line => !line.trimStart().startsWith('//'))
    .join('\n');
}
