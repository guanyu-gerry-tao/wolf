import { resolveWorkspaceDir } from '../../utils/instance.js';
import {
  CURRENT_SCHEMA_VERSION,
  readSchemaVersion,
  runMigrations,
} from '../../runtime/migrations/index.js';

/**
 * `wolf migrate` — explicit, user-triggered workspace schema upgrade.
 *
 * Reads the workspace's recorded `schemaVersion` from `wolf.toml`, plans the
 * migrations needed to reach `CURRENT_SCHEMA_VERSION`, and runs them in order.
 * Prints a one-line summary at start, one line per step, and a final
 * summary at end.
 *
 * `--dry-run` prints the plan without executing any migration. Useful before
 * a real run so the user can spot-check what will happen.
 *
 * The runner itself preserves wolf.toml's `schemaVersion` value at the
 * pre-run state on any mid-chain failure. The user-facing error message
 * names the failed step and points at `.wolf/backups/` for recovery.
 */
export interface MigrateOptions {
  dryRun?: boolean;
}

/** CLI entry point. Returns nothing; prints to stdout/stderr and lets errors bubble. */
export async function migrate(options: MigrateOptions = {}): Promise<void> {
  const workspaceDir = resolveWorkspaceDir();
  const from = await readSchemaVersion(workspaceDir);
  const to = CURRENT_SCHEMA_VERSION;

  if (from === to) {
    process.stdout.write(
      `Workspace is already at schema v${to}. Nothing to migrate.\n`,
    );
    return;
  }

  // Banner so the user can see at a glance what they're about to commit to.
  // Skip the banner in dry-run since we'll print the same info as part of
  // the plan-only output.
  if (!options.dryRun) {
    process.stdout.write(
      `Migrating workspace at ${workspaceDir}\n` +
      `  from schema v${from} to schema v${to}\n\n`,
    );
  } else {
    process.stdout.write(
      `[DRY RUN] would migrate workspace at ${workspaceDir}\n` +
      `  from schema v${from} to schema v${to}\n\n`,
    );
  }

  const result = await runMigrations(workspaceDir, { dryRun: options.dryRun });

  // The plan is always populated; ran is empty in dryRun.
  for (let i = 0; i < result.plan.length; i++) {
    const step = result.plan[i];
    const prefix = options.dryRun
      ? `  [${i + 1}/${result.plan.length}] would run`
      : `  [${i + 1}/${result.plan.length}] ran`;
    process.stdout.write(
      `${prefix}: v${step.fromVersion} → v${step.toVersion}  ${step.description}\n`,
    );
  }

  process.stdout.write('\n');
  if (options.dryRun) {
    process.stdout.write(
      `[DRY RUN] no changes written. Re-run without --dry-run to apply.\n`,
    );
  } else {
    process.stdout.write(
      `Done. Workspace is now at schema v${result.to}.\n`,
    );
  }
}
