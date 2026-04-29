/**
 * Barrel re-export for typed errors. Import from here when consuming
 * errors at CLI / MCP boundaries so a single import line covers everything.
 */
export { MissingApiKeyError } from './missingApiKeyError.js';
export { MissingChromiumError } from './missingChromiumError.js';
export { WorkspaceNotInitializedError } from './workspaceNotInitializedError.js';
