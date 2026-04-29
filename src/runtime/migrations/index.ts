import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parse } from 'smol-toml';
import { loadConfig, saveConfig } from '../../utils/config.js';
import { log } from '../../utils/logger.js';

/**
 * Workspace schema migration runtime.
 *
 * # What this is
 *
 * wolf is in 0.x — workspace format is **not stable**. Whenever a wolf
 * release introduces a breaking workspace-format change (renaming a
 * profile field, moving prose from `.md` files into SQLite columns, etc.)
 * it lands in this directory as a `Migration` entry that bumps a workspace
 * from `fromVersion` to `toVersion`. New code reads the workspace's recorded
 * `schemaVersion` from `wolf.toml`, runs ordered migrations from there up
 * to `CURRENT_SCHEMA_VERSION`, and writes the new version on success.
 *
 * # Contract
 *
 * - **Missing `schemaVersion` is treated as v1** (the pre-migration
 *   baseline). All workspaces created before this runtime existed are v1.
 * - Migrations run in order, each closing exactly one fromVersion →
 *   toVersion gap. There is no skipping or batching — a v1 → v3 upgrade
 *   runs `v1 → v2` first, then `v2 → v3`.
 * - **No downgrade.** `planMigrations(2, 1)` throws. Pre-1.0 hard-cut
 *   policy: failed upgrades require restoring from backup, not auto-revert.
 * - The runner updates `wolf.toml`'s `schemaVersion` only after **all**
 *   planned migrations succeed. A failure mid-way leaves the workspace at
 *   its pre-run version (so a fixed wolf binary can re-run from where it
 *   stopped — assuming each migration's `run()` is idempotent or the user
 *   restores backup first).
 *
 * # Why no rollback / partial-state recovery
 *
 * Pre-1.0 user base is small. Building a transactional rollback layer or
 * checkpoint-based partial-state recovery is engineering-expensive and
 * almost never used. Failed migrations document the recovery path
 * ("restore from `.wolf/backups/`") in the user-facing error.
 *
 * # Adding a migration
 *
 * 1. Bump `CURRENT_SCHEMA_VERSION`.
 * 2. Create `src/runtime/migrations/v<N>ToV<N+1>.ts` exporting a
 *    `Migration`.
 * 3. Append it to `MIGRATIONS` in declaration order.
 * 4. Add a unit test that runs the migration end-to-end on a tmp workspace.
 * 5. Document what user-visible files / DB tables are touched in the
 *    migration's `description` and in the project's CHANGELOG.
 */

/**
 * One ordered upgrade step. `run` MUST be idempotent enough that re-running
 * it after a partial failure is safe (or at minimum well-documented in its
 * error message, e.g. "restore from `.wolf/backups/v1/` and retry").
 */
export interface Migration {
  /** The schema version this migration upgrades FROM. Must match the workspace's recorded `schemaVersion`. */
  fromVersion: number;
  /** The schema version this migration upgrades TO. Must equal `fromVersion + 1`. */
  toVersion: number;
  /** Short human-readable summary, surfaced by `wolf migrate --dry-run` and in `migrate.start` log events. */
  description: string;
  /** The actual migration work. `workspaceDir` is the absolute path to the workspace root. */
  run(workspaceDir: string): Promise<void>;
}

/**
 * Highest schema version this binary knows how to migrate UP to. Bumped
 * in lock-step with the last entry in `MIGRATIONS`. A workspace whose
 * recorded schemaVersion is greater than this means the user is running
 * an older binary against a newer workspace — refuse to run.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Ordered registry of migrations. Empty in commit α (this commit) — the
 * first concrete migration (v1 → v2: profile.md → profile.toml + jd.md →
 * SQLite description_md column) lands in commit β.
 *
 * Tests pass a custom registry into `planMigrations` / `runMigrations` so
 * the framework can be exercised without coupling to whatever real
 * migrations have been added.
 */
export const MIGRATIONS: ReadonlyArray<Migration> = [];

/**
 * Reads the workspace's recorded `schemaVersion` from `wolf.toml`.
 *
 * Uses a minimal TOML parse (no zod schema) so a workspace whose `wolf.toml`
 * shape has drifted from the current `AppConfigSchema` (e.g. older binary
 * with extra fields, or future binary with new required fields) can still
 * report its version. This is intentional: the runner needs to find out
 * "what version is this workspace?" before deciding whether the binary
 * can even validate the rest of the config.
 *
 * @returns the recorded version, or `1` if the field is missing or invalid.
 */
export async function readSchemaVersion(workspaceDir: string): Promise<number> {
  const tomlPath = path.join(workspaceDir, 'wolf.toml');
  let raw: string;
  try {
    raw = await readFile(tomlPath, 'utf-8');
  } catch {
    // No wolf.toml means the workspace was never initialized; surface
    // that as v1 so the caller's "schema mismatch" check fires its
    // typed error path. We do not throw here because the runtime's
    // version-mismatch handling has better messaging than a raw ENOENT.
    return 1;
  }
  let obj: unknown;
  try {
    obj = parse(raw);
  } catch {
    return 1;
  }
  if (typeof obj === 'object' && obj !== null && 'schemaVersion' in obj) {
    const v = (obj as Record<string, unknown>).schemaVersion;
    if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v;
  }
  return 1;
}

/**
 * Returns true when the workspace's recorded schemaVersion equals the
 * binary's `CURRENT_SCHEMA_VERSION`. Used by other commands to decide
 * whether to abort with a "run `wolf migrate`" message.
 */
export async function isSchemaCurrent(workspaceDir: string): Promise<boolean> {
  const v = await readSchemaVersion(workspaceDir);
  return v === CURRENT_SCHEMA_VERSION;
}

/**
 * Plans the ordered migrations needed to upgrade from `from` to `to`.
 *
 * Throws if:
 *   - `to < from` (no downgrade support)
 *   - The registry has a gap (e.g. workspace at v1, target v3, but only
 *     v1→v2 is registered — v2→v3 missing)
 *   - The registry has duplicate steps for the same fromVersion
 *
 * Returns `[]` when `from === to` (no work to do).
 *
 * @param registry - Defaults to the module-level `MIGRATIONS` constant.
 *   Tests pass a custom registry to exercise the runner without depending
 *   on whichever real migrations have shipped.
 */
export function planMigrations(
  from: number,
  to: number,
  registry: ReadonlyArray<Migration> = MIGRATIONS,
): Migration[] {
  if (!Number.isInteger(from) || from < 1) {
    throw new Error(`planMigrations: invalid from=${from} (must be a positive integer)`);
  }
  if (!Number.isInteger(to) || to < 1) {
    throw new Error(`planMigrations: invalid to=${to} (must be a positive integer)`);
  }
  if (to < from) {
    throw new Error(
      `planMigrations: cannot downgrade (from=${from}, to=${to}). ` +
      `Restore from a backup if you need an older schema.`,
    );
  }
  if (to === from) return [];

  // Build an index of fromVersion → migration for quick lookup. Detect
  // duplicates explicitly so a misregistered migration is loud, not silent.
  const byFrom = new Map<number, Migration>();
  for (const m of registry) {
    if (m.toVersion !== m.fromVersion + 1) {
      throw new Error(
        `Migration "${m.description}" has invalid step ` +
        `(${m.fromVersion} → ${m.toVersion}); each step must close exactly one version.`,
      );
    }
    if (byFrom.has(m.fromVersion)) {
      throw new Error(
        `Duplicate migration registered for fromVersion=${m.fromVersion}: ` +
        `"${byFrom.get(m.fromVersion)!.description}" and "${m.description}".`,
      );
    }
    byFrom.set(m.fromVersion, m);
  }

  const planned: Migration[] = [];
  for (let v = from; v < to; v++) {
    const step = byFrom.get(v);
    if (!step) {
      throw new Error(
        `No migration registered for v${v} → v${v + 1}. ` +
        `Cannot upgrade workspace from v${from} to v${to}.`,
      );
    }
    planned.push(step);
  }
  return planned;
}

/** Options bag for `runMigrations`. Keeps the signature flexible without exploding into many params. */
export interface RunMigrationsOptions {
  /** Where to migrate to. Defaults to `CURRENT_SCHEMA_VERSION`. */
  targetVersion?: number;
  /** When true: log the plan and return without running. `wolf migrate --dry-run` uses this. */
  dryRun?: boolean;
  /** Registry override for tests. Defaults to the module-level `MIGRATIONS`. */
  registry?: ReadonlyArray<Migration>;
}

/** What `runMigrations` returns. Useful for the CLI / tests to render summaries. */
export interface RunMigrationsResult {
  /** The starting schemaVersion read from the workspace before running. */
  from: number;
  /** The schemaVersion the workspace ended at — equals `to` from input on success, or `from` on failure. */
  to: number;
  /** The migrations actually executed, in order. Empty on `from === target` or `dryRun`. */
  ran: Migration[];
  /** The plan that would run (always populated, including in dryRun). */
  plan: Migration[];
}

/**
 * Reads the workspace's current schema version, plans the migrations
 * needed to reach the target, and (unless `dryRun`) runs them in order.
 *
 * After all migrations succeed, the workspace's `schemaVersion` is
 * updated in `wolf.toml`. On any failure mid-run, `schemaVersion` stays
 * at the pre-run value — the user sees the typed error and is responsible
 * for restoring from backup before retrying.
 *
 * Logs `migrate.start` / `migrate.step.start` / `migrate.step.done` /
 * `migrate.done` events so the migration run leaves a structured trail
 * in `data/logs/wolf.log.jsonl`.
 */
export async function runMigrations(
  workspaceDir: string,
  opts: RunMigrationsOptions = {},
): Promise<RunMigrationsResult> {
  const target = opts.targetVersion ?? CURRENT_SCHEMA_VERSION;
  const registry = opts.registry ?? MIGRATIONS;

  const from = await readSchemaVersion(workspaceDir);
  const plan = planMigrations(from, target, registry);

  log.info('migrate.start', {
    workspaceDir,
    from,
    target,
    stepCount: plan.length,
    dryRun: opts.dryRun ?? false,
  });

  if (opts.dryRun) {
    return { from, to: from, ran: [], plan };
  }

  if (plan.length === 0) {
    return { from, to: from, ran: [], plan };
  }

  const ran: Migration[] = [];
  for (const step of plan) {
    log.info('migrate.step.start', {
      from: step.fromVersion,
      to: step.toVersion,
      description: step.description,
    });
    const startedAt = Date.now();
    try {
      await step.run(workspaceDir);
    } catch (err) {
      // Leave schemaVersion at pre-run `from`. The user-facing message
      // names the step that failed so recovery is targeted.
      log.error('migrate.step.failed', {
        from: step.fromVersion,
        to: step.toVersion,
        description: step.description,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new Error(
        `Migration v${step.fromVersion} → v${step.toVersion} failed: ${
          err instanceof Error ? err.message : String(err)
        }. ` +
        `Workspace is still at v${from}. Restore from .wolf/backups/ if needed and retry.`,
      );
    }
    log.info('migrate.step.done', {
      from: step.fromVersion,
      to: step.toVersion,
      durationMs: Date.now() - startedAt,
    });
    ran.push(step);
  }

  // All steps succeeded — commit the new schemaVersion to wolf.toml.
  // We re-read the config after migrations because migrations themselves
  // may have modified other fields in wolf.toml (additive changes).
  const config = await loadConfig(workspaceDir);
  const updated = { ...config, schemaVersion: target };
  await saveConfig(updated, workspaceDir);

  log.info('migrate.done', { workspaceDir, from, to: target, ran: ran.length });
  return { from, to: target, ran, plan };
}
