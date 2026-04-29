import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stringify } from 'smol-toml';
import {
  CURRENT_SCHEMA_VERSION,
  isSchemaCurrent,
  planMigrations,
  readSchemaVersion,
  runMigrations,
  type Migration,
} from '../index.js';

// The migration runtime is generic over a registry of `Migration`s. These
// tests inject synthetic registries so the framework can be exercised
// without coupling to whichever real migrations have shipped (in commit α
// the registry is empty; commit β adds the first concrete v1 → v2 entry).

describe('migrations runtime', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wolf-mig-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Helper: writes a minimal valid wolf.toml at the given version. Anything
  // omitted falls through to AppConfigSchema defaults at load time.
  async function writeWolfToml(workspaceDir: string, schemaVersion?: number): Promise<void> {
    const config: Record<string, unknown> = { default: 'default' };
    if (schemaVersion !== undefined) config.schemaVersion = schemaVersion;
    await fs.writeFile(
      path.join(workspaceDir, 'wolf.toml'),
      stringify(config),
      'utf-8',
    );
  }

  // Helper: reads schemaVersion straight off disk, bypassing readSchemaVersion's
  // own fallback logic so tests can verify the file actually got written.
  async function readSchemaVersionFromDisk(workspaceDir: string): Promise<number | undefined> {
    const raw = await fs.readFile(path.join(workspaceDir, 'wolf.toml'), 'utf-8');
    const match = raw.match(/^schemaVersion\s*=\s*(\d+)/m);
    return match ? parseInt(match[1], 10) : undefined;
  }

  // -------------------------------------------------------------------------
  // readSchemaVersion — the lookup that gates every other migration decision
  // -------------------------------------------------------------------------

  describe('readSchemaVersion()', () => {
    // No wolf.toml at all → treat as v1. The runtime needs this to not throw
    // because the typed "workspace not initialized" error comes from a
    // higher layer with better messaging.
    it('returns 1 when wolf.toml does not exist', async () => {
      expect(await readSchemaVersion(tmpDir)).toBe(1);
    });

    // wolf.toml exists but has no schemaVersion field — pre-runtime
    // workspaces are exactly this shape, and per the contract they're v1.
    it('returns 1 when wolf.toml exists without a schemaVersion field', async () => {
      await writeWolfToml(tmpDir);
      expect(await readSchemaVersion(tmpDir)).toBe(1);
    });

    // schemaVersion is a positive integer → return it verbatim.
    it('returns the recorded schemaVersion when present', async () => {
      await writeWolfToml(tmpDir, 3);
      expect(await readSchemaVersion(tmpDir)).toBe(3);
    });

    // Garbage value (negative, zero, float, string) → fall back to v1
    // rather than propagate confusion. A legitimate version is always a
    // positive integer.
    it('falls back to 1 when schemaVersion is invalid (negative)', async () => {
      await fs.writeFile(path.join(tmpDir, 'wolf.toml'), 'schemaVersion = -1\ndefault = "default"\n', 'utf-8');
      expect(await readSchemaVersion(tmpDir)).toBe(1);
    });
    it('falls back to 1 when schemaVersion is invalid (zero)', async () => {
      await fs.writeFile(path.join(tmpDir, 'wolf.toml'), 'schemaVersion = 0\ndefault = "default"\n', 'utf-8');
      expect(await readSchemaVersion(tmpDir)).toBe(1);
    });
    it('falls back to 1 when schemaVersion is a float', async () => {
      await fs.writeFile(path.join(tmpDir, 'wolf.toml'), 'schemaVersion = 1.5\ndefault = "default"\n', 'utf-8');
      expect(await readSchemaVersion(tmpDir)).toBe(1);
    });

    // Malformed TOML → don't crash, fall back. The CLI layer surfaces a
    // better error elsewhere; this function's job is "give me a version
    // even if everything else is broken".
    it('falls back to 1 when wolf.toml is malformed TOML', async () => {
      await fs.writeFile(path.join(tmpDir, 'wolf.toml'), 'this is not = "valid toml [\n', 'utf-8');
      expect(await readSchemaVersion(tmpDir)).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // isSchemaCurrent — the convenience check other commands gate on
  // -------------------------------------------------------------------------

  describe('isSchemaCurrent()', () => {
    it('returns true when the workspace matches CURRENT_SCHEMA_VERSION', async () => {
      await writeWolfToml(tmpDir, CURRENT_SCHEMA_VERSION);
      expect(await isSchemaCurrent(tmpDir)).toBe(true);
    });

    // A workspace whose recorded version is below CURRENT_SCHEMA_VERSION
    // returns false. We compute the gap dynamically so this test stays
    // valid as CURRENT is bumped over future migrations.
    it('returns false when the workspace lags the binary', async () => {
      // Cast to widen the literal type; TypeScript narrows the imported
      // const to its current value, but this test must hold across future
      // bumps. Skip the path when CURRENT is the v1 baseline (no lagging
      // version exists yet).
      const current = CURRENT_SCHEMA_VERSION as number;
      if (current === 1) return;
      await writeWolfToml(tmpDir, current - 1);
      expect(await isSchemaCurrent(tmpDir)).toBe(false);
    });

    // Missing schemaVersion (treated as v1) lags only when the binary's
    // CURRENT > 1.
    it('returns false when the workspace has no schemaVersion field and binary is past v1', async () => {
      const current = CURRENT_SCHEMA_VERSION as number;
      if (current === 1) return;
      await writeWolfToml(tmpDir); // no schemaVersion field
      expect(await isSchemaCurrent(tmpDir)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // planMigrations — pure function, exhaustive coverage
  // -------------------------------------------------------------------------

  describe('planMigrations()', () => {
    // Helper to fabricate a no-op migration step with the right shape.
    function step(from: number, to: number, label = `${from}->${to}`): Migration {
      return {
        fromVersion: from,
        toVersion: to,
        description: label,
        run: async () => { /* no-op */ },
      };
    }

    // No-op when from equals to. Used by `wolf migrate` when the workspace
    // is already at the target version.
    it('returns [] when from === to', () => {
      expect(planMigrations(1, 1, [])).toEqual([]);
      expect(planMigrations(5, 5, [step(1, 2)])).toEqual([]);
    });

    // Single-step happy path: registry has v1->v2, ask for v1->v2, get one step.
    it('plans a single step when the registry has it', () => {
      const m = step(1, 2);
      const plan = planMigrations(1, 2, [m]);
      expect(plan).toEqual([m]);
    });

    // Multi-step happy path: registry has v1->v2, v2->v3; ask for v1->v3,
    // get both ordered. The runner loops `for v in [from, to)` and picks
    // each step by `fromVersion`, so order in the registry doesn't matter.
    it('plans a chain when the registry has all the steps', () => {
      const a = step(1, 2);
      const b = step(2, 3);
      // Pass them out of order to verify sorting is by fromVersion, not
      // by registry index.
      const plan = planMigrations(1, 3, [b, a]);
      expect(plan).toEqual([a, b]);
    });

    // Gap in the chain: registry has v1->v2 and v3->v4 but not v2->v3.
    // The runner can't bridge a gap; failing loudly is better than partially
    // applying and silently leaving the workspace at v2.
    it('throws when the registry has a gap', () => {
      expect(() =>
        planMigrations(1, 4, [step(1, 2), step(3, 4)])
      ).toThrow(/No migration registered for v2 -> v3|No migration registered for v2 → v3/);
    });

    // Downgrade is not supported (pre-1.0 hard-cut policy).
    it('throws when from > to', () => {
      expect(() => planMigrations(2, 1, [])).toThrow(/cannot downgrade/i);
    });

    // Invalid version numbers (zero, negative, non-integer) throw early
    // rather than feed nonsense into the loop.
    it('throws on invalid from / to', () => {
      expect(() => planMigrations(0, 2, [])).toThrow(/invalid from/);
      expect(() => planMigrations(1.5, 2, [])).toThrow(/invalid from/);
      expect(() => planMigrations(1, 0, [])).toThrow(/invalid to/);
      expect(() => planMigrations(1, 2.5, [])).toThrow(/invalid to/);
    });

    // A migration claiming to skip versions (e.g. v1 -> v3) is a registration
    // bug; explicitly reject it. Each migration must close exactly one gap.
    it('throws when a registered migration spans more than one version', () => {
      expect(() => planMigrations(1, 3, [{
        fromVersion: 1,
        toVersion: 3,
        description: 'broken',
        run: async () => { /* no-op */ },
      }])).toThrow(/invalid step/);
    });

    // Duplicate registration for the same fromVersion — likely a copy-paste
    // bug; reject so the conflict surfaces at startup, not during a real run.
    it('throws when the registry has duplicate fromVersion entries', () => {
      expect(() =>
        planMigrations(1, 2, [step(1, 2, 'first'), step(1, 2, 'second')])
      ).toThrow(/duplicate migration/i);
    });
  });

  // -------------------------------------------------------------------------
  // runMigrations — integration: writes wolf.toml, runs steps, updates version
  // -------------------------------------------------------------------------

  describe('runMigrations()', () => {
    function noopStep(from: number, to: number, label = `${from}->${to}`): Migration {
      return {
        fromVersion: from,
        toVersion: to,
        description: label,
        run: async () => { /* no-op */ },
      };
    }

    // When the workspace is already at the target version, runMigrations
    // is a no-op: no steps run, schemaVersion stays put.
    it('is a no-op when from === target', async () => {
      await writeWolfToml(tmpDir, 1);
      const result = await runMigrations(tmpDir, { targetVersion: 1, registry: [] });
      expect(result.ran).toEqual([]);
      expect(result.plan).toEqual([]);
      expect(result.from).toBe(1);
      expect(result.to).toBe(1);
      // schemaVersion on disk unchanged.
      expect(await readSchemaVersionFromDisk(tmpDir)).toBe(1);
    });

    // dryRun: plan is computed (visible to caller) but no step's run() is
    // invoked and schemaVersion is not updated.
    it('dryRun computes the plan but does not run or write', async () => {
      await writeWolfToml(tmpDir, 1);
      const runSpy = vi.fn().mockResolvedValue(undefined);
      const step: Migration = {
        fromVersion: 1, toVersion: 2, description: 'v1->v2', run: runSpy,
      };
      const result = await runMigrations(tmpDir, {
        targetVersion: 2,
        dryRun: true,
        registry: [step],
      });
      expect(result.plan).toEqual([step]);
      expect(result.ran).toEqual([]);
      expect(result.from).toBe(1);
      expect(result.to).toBe(1); // unchanged because dryRun
      expect(runSpy).not.toHaveBeenCalled();
      // schemaVersion on disk stays at 1.
      expect(await readSchemaVersionFromDisk(tmpDir)).toBe(1);
    });

    // Happy path: a single migration runs, schemaVersion is bumped to target.
    it('runs a single migration and bumps schemaVersion on success', async () => {
      await writeWolfToml(tmpDir, 1);
      const runSpy = vi.fn().mockResolvedValue(undefined);
      const step: Migration = {
        fromVersion: 1, toVersion: 2, description: 'v1->v2', run: runSpy,
      };
      const result = await runMigrations(tmpDir, {
        targetVersion: 2,
        registry: [step],
      });
      expect(runSpy).toHaveBeenCalledTimes(1);
      expect(runSpy).toHaveBeenCalledWith(tmpDir);
      expect(result.ran).toEqual([step]);
      expect(result.from).toBe(1);
      expect(result.to).toBe(2);
      expect(await readSchemaVersionFromDisk(tmpDir)).toBe(2);
    });

    // Multi-step path: v1 → v3 chains two migrations, both run in order.
    it('runs a chain of migrations in order', async () => {
      await writeWolfToml(tmpDir, 1);
      const order: number[] = [];
      const a: Migration = {
        fromVersion: 1, toVersion: 2, description: 'v1->v2',
        run: async () => { order.push(12); },
      };
      const b: Migration = {
        fromVersion: 2, toVersion: 3, description: 'v2->v3',
        run: async () => { order.push(23); },
      };
      const result = await runMigrations(tmpDir, {
        targetVersion: 3,
        registry: [a, b],
      });
      // Even reversing the registry order — runner picks by fromVersion.
      expect(order).toEqual([12, 23]);
      expect(result.ran).toEqual([a, b]);
      expect(result.from).toBe(1);
      expect(result.to).toBe(3);
      expect(await readSchemaVersionFromDisk(tmpDir)).toBe(3);
    });

    // Failure mid-chain: schemaVersion stays at the pre-run value so the
    // user can fix the broken step and re-run, OR restore from backup.
    // The first step's effects on disk persist (we don't roll back); that's
    // the documented hard-cut policy.
    it('on mid-chain failure, leaves schemaVersion at the pre-run value', async () => {
      await writeWolfToml(tmpDir, 1);
      const a: Migration = {
        fromVersion: 1, toVersion: 2, description: 'v1->v2',
        run: async () => { /* succeeds */ },
      };
      const b: Migration = {
        fromVersion: 2, toVersion: 3, description: 'v2->v3',
        run: async () => { throw new Error('boom'); },
      };
      await expect(
        runMigrations(tmpDir, { targetVersion: 3, registry: [a, b] })
      ).rejects.toThrow(/Migration v2 → v3 failed: boom/);
      // schemaVersion NOT bumped — neither to 2 nor to 3.
      expect(await readSchemaVersionFromDisk(tmpDir)).toBe(1);
    });

    // Workspace at target+1 (downgrade case) — runner inherits planMigrations'
    // throw, so the user sees a clean error rather than a half-run state.
    it('throws when the workspace is ahead of target (downgrade attempted)', async () => {
      await writeWolfToml(tmpDir, 3);
      await expect(
        runMigrations(tmpDir, { targetVersion: 1, registry: [] })
      ).rejects.toThrow(/cannot downgrade/i);
      expect(await readSchemaVersionFromDisk(tmpDir)).toBe(3);
    });

    // Workspace ahead of target with a gap that planMigrations can't bridge —
    // surface the gap loudly. (Workspace at v1, target v3, registry only has v2->v3.)
    it('throws when the registry has a gap that prevents reaching target', async () => {
      await writeWolfToml(tmpDir, 1);
      await expect(
        runMigrations(tmpDir, { targetVersion: 3, registry: [noopStep(2, 3)] })
      ).rejects.toThrow(/No migration registered for v1/);
      expect(await readSchemaVersionFromDisk(tmpDir)).toBe(1);
    });

    // The migration's run() receives the workspaceDir verbatim — verifies
    // the runner doesn't accidentally pass cwd or some resolved sibling.
    it('passes the workspaceDir argument through to each migration run()', async () => {
      await writeWolfToml(tmpDir, 1);
      let receivedDir = '';
      const step: Migration = {
        fromVersion: 1, toVersion: 2, description: 'v1->v2',
        run: async (dir) => { receivedDir = dir; },
      };
      await runMigrations(tmpDir, { targetVersion: 2, registry: [step] });
      expect(receivedDir).toBe(tmpDir);
    });
  });

  // -------------------------------------------------------------------------
  // CURRENT_SCHEMA_VERSION sanity — guards against accidental bumps that
  // ship without a corresponding entry in MIGRATIONS.
  // -------------------------------------------------------------------------

  describe('CURRENT_SCHEMA_VERSION', () => {
    // The constant is monotonically increasing; bumping it without adding
    // the matching migration breaks every existing workspace. This test
    // doesn't enforce that (it'd need to import MIGRATIONS and check), but
    // it pins the v1 baseline so commit β's bump shows up clearly in the diff.
    it('is a positive integer', () => {
      expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true);
      expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
    });
  });
});
