/**
 * Single source of truth for which CLI commands are implemented vs. still
 * scheduled for a future milestone. Consumed by:
 *   - `src/cli/index.ts` to decorate command descriptions in `--help` and
 *     to emit a clean "not yet available" stderr line + exit 1 instead of
 *     a raw stack trace when a stub command is invoked.
 *   - `src/application/impl/templates/workspace-claude.md` (the bundled
 *     template that populates the workspace's CLAUDE.md / AGENTS.md). The
 *     table in that template is hand-mirrored from this constant — keep
 *     the two in sync when adding/removing a command.
 *
 * `available: true` means the command actually works end-to-end. `false`
 * means the application-service stub still throws `Not implemented`.
 */
export const COMMAND_STATUS = {
  // Available
  init: { available: true },
  add: { available: true },
  tailor: { available: true },
  status: { available: true },
  doctor: { available: true },
  job: { available: true },
  profile: { available: true },
  config: { available: true },
  env: { available: true },
  mcp: { available: true },

  // Not yet — milestone they ship in
  hunt: { available: false, milestone: 'M2' },
  score: { available: false, milestone: 'M2' },
  fill: { available: false, milestone: 'M4' },
  reach: { available: false, milestone: 'M5' },
} as const satisfies Record<string, { available: true } | { available: false; milestone: string }>;

export type CommandName = keyof typeof COMMAND_STATUS;

/**
 * Suffix to append to a command's `--help` description so users see at a
 * glance that the verb exists in the binary but is on the roadmap, not
 * shippable. Returns an empty string for available commands.
 */
export function statusTag(name: CommandName): string {
  const s = COMMAND_STATUS[name];
  return s.available ? '' : ` [NOT YET IMPLEMENTED — ${s.milestone}]`;
}

/**
 * One-liner the action handler prints to stderr when a not-yet-available
 * command is invoked. Always paired with `process.exit(1)`.
 */
export function notYetMessage(name: CommandName): string {
  const s = COMMAND_STATUS[name];
  if (s.available) throw new Error(`notYetMessage called for available command: ${name}`);
  return `wolf ${name}: not yet available in this release (${s.milestone}). See https://github.com/guanyu-gerry-tao/wolf/blob/main/docs/overview/MILESTONES.md for the roadmap.`;
}
