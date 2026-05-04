/**
 * `wolf context --for=<scenario>` — outputs an AI-prompt-friendly markdown
 * context bundle scoped to a specific use case. Different from `wolf
 * profile show` (raw TOML for human / debug); this command is what AI
 * agents actually read into their conversation context.
 *
 * # Why a separate command from `show`
 *
 * - `show` dumps raw TOML including comments / formatting / empty fields.
 *   That's noise for an AI prompt and confuses the model about which
 *   fields are filled.
 * - `context` filters by scenario relevance (search shouldn't see
 *   identity / address; tailor shouldn't see search-only metadata) and
 *   prepends a short "how to use this" header so the agent knows what
 *   the bundle is for.
 *
 * # Cache friendliness
 *
 * Output is deterministic — same profile.toml input → same byte-for-byte
 * output. Lets AI clients (Claude Code's `cache_control: ephemeral`,
 * OpenAI prefix cache) cache the bundle and pay only the delta on
 * subsequent calls. We don't sprinkle timestamps / random ids in the body.
 */
export type ContextScenario = 'search' | 'tailor';

export interface ContextApplicationService {
  /**
   * Returns the markdown bundle for the given scenario. The CLI prints
   * this to stdout. AI agents (via Bash / shell-out) capture and inject
   * the output into their prompt as a verbatim system / user-message block.
   */
  render(scenario: ContextScenario, opts?: { profileName?: string }): Promise<string>;
}
