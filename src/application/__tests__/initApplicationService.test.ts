import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { InitApplicationServiceImpl } from '../impl/initApplicationServiceImpl.js';
import * as instance from '../../utils/instance.js';

// `ensureAgentInstructions` composes the workspace agent file from a shared
// skeleton plus a build-specific segment (stable -> "no need to volunteer
// internals"; dev -> "Dev log convention"). These tests pin the split: the
// produced CLAUDE.md / AGENTS.md must contain exactly one of the two
// segments depending on whether the running binary is dev or stable.
describe('InitApplicationServiceImpl.writeWorkspace agent instructions', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wolf-init-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Helper: invoke writeWorkspace with a minimal config so the test only has
  // to assert on the agent files. We don't care which keys the config has —
  // saveConfig writes wolf.toml and the agent-instruction code path is
  // independent of that.
  async function runInit(): Promise<{ claude: string; agents: string }> {
    const svc = new InitApplicationServiceImpl();
    await svc.writeWorkspace({
      workspaceDir: tmpDir,
      config: svc.buildDefaultConfig(),
      overwriteConfig: true,
    });
    const claude = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    const agents = await fs.readFile(path.join(tmpDir, 'AGENTS.md'), 'utf-8');
    return { claude, agents };
  }

  // Stable build path: ensureAgentInstructions appends agent-stable.md, NOT
  // agent-dev.md. The "Audience note" heading is the unique marker of the
  // stable segment; "Dev log convention" is the unique marker of dev.
  it('stable build: workspace CLAUDE.md / AGENTS.md include the stable segment, not the dev segment', async () => {
    vi.spyOn(instance, 'isDevBuild').mockReturnValue(false);
    vi.spyOn(instance, 'currentBinaryName').mockReturnValue('wolf');
    const { claude, agents } = await runInit();

    // Both files are written from the same composed string — assert once
    // per file to catch any accidental divergence between them.
    expect(claude).toContain('## Audience note');
    expect(claude).not.toContain('## Dev log convention');
    expect(agents).toContain('## Audience note');
    expect(agents).not.toContain('## Dev log convention');

    // The skeleton's __WOLF_BIN__ placeholders should resolve to "wolf"
    // (not "wolf-dev") in stable builds — verifies the composed string is
    // run through replaceAll.
    expect(claude).toContain('`wolf doctor`');
    expect(claude).not.toContain('`wolf-dev doctor`');
  });

  // Dev build path: opposite expectations. The Dev log convention is what
  // makes the dev segment useful (telemetry-style end-of-reply summaries
  // when the wolf author is iterating).
  it('dev build: workspace CLAUDE.md / AGENTS.md include the dev segment, not the stable segment', async () => {
    vi.spyOn(instance, 'isDevBuild').mockReturnValue(true);
    vi.spyOn(instance, 'currentBinaryName').mockReturnValue('wolf-dev');
    const { claude, agents } = await runInit();

    expect(claude).toContain('## Dev log convention');
    expect(claude).not.toContain('## Audience note');
    expect(agents).toContain('## Dev log convention');
    expect(agents).not.toContain('## Audience note');

    // __WOLF_BIN__ resolves to "wolf-dev" in dev builds — same composed
    // string runs through one replaceAll, so the bin substitution must
    // apply to the dev segment too (it references `__WOLF_BIN__` in a
    // sentence about the dev binary).
    expect(claude).toContain('`wolf-dev`');
    expect(claude).not.toContain('__WOLF_BIN__');
  });

  // Source-code references like `src/utils/stripComments.ts` and
  // `src/application/impl/...` were leaking into the workspace skeleton —
  // they don't exist in any user (or dev-workspace) directory, so AI
  // helpers got told to "see file X" for files that aren't there.
  // This test guards against any future regression that re-introduces a
  // src-prefixed reference in the build-agnostic skeleton.
  it('skeleton no longer cites internal source paths (src/...)', async () => {
    vi.spyOn(instance, 'isDevBuild').mockReturnValue(false);
    vi.spyOn(instance, 'currentBinaryName').mockReturnValue('wolf');
    const { claude } = await runInit();

    // Match an inline-code or bracketed src path. The per-job artifact
    // directory `data/jobs/<...>/src/` IS legitimate (a workspace path),
    // so we look for any "src/<word>" / "[src/<word>" / "`src/<word>"
    // occurrence that is NOT prefixed by "jobs/" or similar workspace path.
    const badRefs = claude.match(/(?<!data\/jobs\/[^\s`)\]]*\/)\bsrc\/[a-zA-Z]/g) ?? [];
    expect(badRefs).toEqual([]);
  });
});
