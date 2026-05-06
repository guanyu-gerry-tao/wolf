/**
 * Tier registry for `wolf score`.
 *
 * Tiers are stored as INTEGER indices in SQLite (`jobs.tier_ai`,
 * `jobs.tier_user`) and named here in TypeScript. **The order is the
 * meaning** — index 0 is the worst fit (skip), index N-1 is the best
 * (invest). Higher index = more worth investing in.
 *
 * To rename a tier: edit the string in `TIER_NAMES`. Recompile.
 * To add a tier: append (or insert at the right position — but inserting
 * shifts existing indices and changes the meaning of every persisted job).
 * To remove a tier: discuss workspace-data implications first; this is a
 * data migration, not a runtime knob.
 */
export const TIER_NAMES = ['skip', 'mass_apply', 'tailor', 'invest'] as const;

export type TierName = (typeof TIER_NAMES)[number];
export type TierIndex = 0 | 1 | 2 | 3;

/** Convert an index back to the canonical name. Throws on out-of-range. */
export function tierNameOf(index: TierIndex): TierName {
  const name = TIER_NAMES[index];
  if (name === undefined) throw new Error(`tierNameOf: invalid index ${index}`);
  return name;
}

/**
 * Parse a string into a tier index. Accepts the canonical name
 * (case-insensitive) or a stringified integer in range. Returns null on
 * unknown input so callers can produce friendly errors that include the
 * full list of valid names.
 */
export function tierIndexOf(input: string): TierIndex | null {
  const trimmed = input.trim().toLowerCase();
  const byName = TIER_NAMES.indexOf(trimmed as TierName);
  if (byName >= 0) return byName as TierIndex;
  // Allow `wolf job set tier 3` for parity with raw DB values.
  if (/^[0-9]+$/.test(trimmed)) {
    const n = Number(trimmed);
    if (n >= 0 && n < TIER_NAMES.length) return n as TierIndex;
  }
  return null;
}

/** Whether a tier is at or above another (e.g. `>= 'tailor'`). */
export function tierAtLeast(tier: TierIndex, threshold: TierName): boolean {
  return tier >= TIER_NAMES.indexOf(threshold);
}

/**
 * Effective tier rule: user override wins over AI verdict; null if neither
 * has been set. Centralized so CLI / HTTP / formatters never re-derive it.
 */
export function effectiveTier(
  tierAi: TierIndex | null,
  tierUser: TierIndex | null,
): TierIndex | null {
  return tierUser ?? tierAi ?? null;
}
