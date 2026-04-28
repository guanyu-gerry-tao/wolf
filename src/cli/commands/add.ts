import type { AddOptions, AddResult } from '../../utils/types/index.js';
import { createAppContext, type AppContext } from '../../runtime/appContext.js';

/**
 * Stores a single job submitted by an AI orchestrator (MCP-only entry point).
 * Thin CLI/MCP wrapper — actual logic lives in AddApplicationService.
 */
export async function add(
  options: AddOptions,
  ctx: AppContext = createAppContext(),
): Promise<AddResult> {
  return ctx.addApp.add(options);
}
