/**
 * Prints an informational message to stdout with the `[wolf]` prefix.
 *
 * @param message - The message to log.
 */
export function log(message: string): void {
  console.log(`[wolf] ${message}`);
}

/**
 * Prints an error message to stderr with the `[wolf] ERROR:` prefix.
 *
 * @param message - The error message to log.
 */
export function error(message: string): void {
  console.error(`[wolf] ERROR: ${message}`);
}
