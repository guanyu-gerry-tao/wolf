import { log } from '../../utils/logger.js';
import type { Migration } from './index.js';

/**
 * v1 → v2 migration — STUB.
 *
 * # Why a stub
 *
 * wolf is pre-1.0 with zero released users. No one has a real v1
 * workspace to migrate. Earlier drafts of this file shipped a 470-line
 * mapping engine (profile.md / resume_pool.md / standard_questions.md →
 * profile.toml; jd.md → jobs.description_md) — that code was correct but
 * was burning 100% on use cases that don't yet exist. We pulled it.
 *
 * The migration runner framework around it (`runMigrations`,
 * `planMigrations`, `wolf migrate`) is **still here** and tested — it's
 * the contract for every future schema bump (v2 → v3 etc.). What's
 * stubbed is only the v1 → v2 step's body.
 *
 * # Behaviour
 *
 * `wolf migrate` on a workspace at schemaVersion=1 will:
 *   - Run this no-op step.
 *   - Have the runner bump schemaVersion to 2 in wolf.toml on success.
 *   - Leave any existing v1 `.md` / `jd.md` files in place, untouched.
 *
 * If a dogfood user (the project author) actually has v1 data, the
 * fastest path is to nuke the workspace and re-init at v2 rather than
 * fix the migration logic — there's no shared real-user data to
 * preserve.
 *
 * # When to bring back the real migration
 *
 * Re-implement (with the old git history as reference) at the point
 * where wolf has shipped a stable v1 to real users AND we want to
 * introduce a v2 schema. Until then, this stub keeps the runner
 * coherent without dragging untested mapping code through CI.
 */
export const v1ToV2: Migration = {
  fromVersion: 1,
  toVersion: 2,
  description:
    'Pre-1.0 stub — no real v1 user data exists to migrate. Re-init your ' +
    'workspace if you have stale v1 .md files in profiles/ or jd.md files ' +
    'under data/jobs/.',
  run: async (workspaceDir: string) => {
    log.info('migrate.v1tov2.stub_noop', {
      workspaceDir,
      hint:
        'v1 → v2 mapping is intentionally not implemented for the pre-1.0 ' +
        'window. If you have legacy .md files, delete them and run wolf init.',
    });
  },
};
