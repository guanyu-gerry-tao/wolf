import { createAppContext, type AppContext } from '../../runtime/appContext.js';
import type { ContextScenario } from '../../application/contextApplicationService.js';

/**
 * Prints the AI-prompt-friendly context bundle for the given scenario.
 *
 * Used by AI agents that drive wolf's adjacent flows (job search in the
 * browser, tailor wrapped in chat, etc.) — they shell out to `wolf
 * context --for=<scenario>` and inject the output into their prompt.
 */
export async function context(
  scenario: ContextScenario,
  ctx: AppContext = createAppContext(),
): Promise<void> {
  const text = await ctx.contextApp.render(scenario);
  process.stdout.write(text.endsWith('\n') ? text : text + '\n');
}
