import fs from 'node:fs/promises';
import path from 'node:path';
import claudeTemplate from './templates/workspace-claude.md';
import { profileTomlTemplate } from '../../utils/profileTomlGenerate.js';
import attachmentsReadmeTemplate from './templates/attachments-readme.md';
import { saveConfig } from '../../utils/config.js';
import { currentBinaryName } from '../../utils/instance.js';
import { CURRENT_SCHEMA_VERSION } from '../../runtime/migrations/index.js';
import { ensureProfilePromptPack } from '../../utils/profilePromptPack.js';
import type { AppConfig } from '../../utils/types/index.js';
import type {
  InitApplicationService,
  WriteWorkspaceOptions,
} from '../initApplicationService.js';

const DEFAULT_PROFILE_NAME = 'default';

/**
 * `InitApplicationService` impl. Owns the bundled markdown templates
 * (imported as raw strings via tsup's `.md` loader) and the workspace
 * skeleton writer. No DB / repo deps — safe to instantiate as a module
 * singleton.
 */
export class InitApplicationServiceImpl implements InitApplicationService {
  readonly defaultProfileName = DEFAULT_PROFILE_NAME;

  /** @inheritdoc */
  buildDefaultConfig(mode?: 'stable' | 'dev'): AppConfig {
    // Write `schemaVersion` explicitly so a freshly initialized workspace
    // declares its version on disk. Fresh installs are already at the
    // binary's `CURRENT_SCHEMA_VERSION` (no migration needed) — but having
    // the field present makes future `wolf migrate` invocations faster (no
    // "missing field, treat as v1" inference) and lets older binaries
    // recognise a too-new workspace and refuse cleanly.
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      ...(mode ? { instance: { mode } } : {}),
      default: DEFAULT_PROFILE_NAME,
      hunt: { minScore: 0.5, maxResults: 50 },
      tailor: { model: 'anthropic/claude-sonnet-4-6' },
      score: { model: 'anthropic/claude-sonnet-4-6' },
      reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
      fill: { model: 'anthropic/claude-haiku-4-5-20251001' },
      companion: { servePort: 47823, maxStagehandSessions: 3, browserMode: 'wolf_persistent_profile' },
    };
  }

  /** @inheritdoc */
  async writeWorkspace(options: WriteWorkspaceOptions): Promise<void> {
    const { workspaceDir, config, overwriteConfig } = options;
    await fs.mkdir(workspaceDir, { recursive: true });

    const configPath = path.join(workspaceDir, 'wolf.toml');
    const configExists = await fs.access(configPath).then(() => true).catch(() => false);
    if (!configExists || overwriteConfig) {
      await saveConfig(config, workspaceDir);
    }

    await writeProfileSkeleton(path.join(workspaceDir, 'profiles', DEFAULT_PROFILE_NAME));
    await fs.mkdir(path.join(workspaceDir, 'data'), { recursive: true });
    await ensureGitignore(workspaceDir);
    await ensureAgentInstructions(workspaceDir);
  }
}

// Writes the v2 profile skeleton: profile.toml, attachments/, and an empty
// prompts/ strategy pack. No file is overwritten if it already exists —
// re-running `wolf init` is safe. v1's profile.md / resume_pool.md /
// standard_questions.md trio is no longer written; existing v1 workspaces
// upgrade via `wolf migrate`.
async function writeProfileSkeleton(profileDir: string): Promise<void> {
  await fs.mkdir(profileDir, { recursive: true });
  await writeIfAbsent(path.join(profileDir, 'profile.toml'), profileTomlTemplate);
  const attachmentsDir = path.join(profileDir, 'attachments');
  await fs.mkdir(attachmentsDir, { recursive: true });
  await writeIfAbsent(path.join(attachmentsDir, 'README.md'), attachmentsReadmeTemplate);
  await ensureProfilePromptPack(profileDir);
}

async function writeIfAbsent(filePath: string, content: string): Promise<void> {
  const exists = await fs.access(filePath).then(() => true).catch(() => false);
  if (!exists) await fs.writeFile(filePath, content, 'utf-8');
}

// .gitignore excludes data/ (auto-managed DB) and profiles/ (contains PII).
async function ensureGitignore(workspaceDir: string): Promise<void> {
  const gitignorePath = path.join(workspaceDir, '.gitignore');
  const wolfIgnoreBlock = '\n# wolf\ndata/\nprofiles/\n';
  try {
    const existing = await fs.readFile(gitignorePath, 'utf-8');
    if (!existing.includes('# wolf')) {
      await fs.appendFile(gitignorePath, wolfIgnoreBlock, 'utf-8');
    }
  } catch {
    await fs.writeFile(gitignorePath, wolfIgnoreBlock.trimStart(), 'utf-8');
  }
}

// CLAUDE.md and AGENTS.md tell any AI assistant operating in this workspace
// (Claude Code, OpenClaw, etc.) how the directory is laid out and what files
// to edit. Same content; both files written so each agent finds its expected name.
//
// The bundled template uses `__WOLF_BIN__` placeholders for any spot that
// names a CLI command the user (or AI agent) might run. We substitute the
// real binary name at write time so a stable workspace's CLAUDE.md says
// `wolf init` while a dev workspace's says `wolf-dev init`. Project-name
// references like "wolf workspace" or "What wolf does" stay literal — they
// describe the project, not commands to type.
async function ensureAgentInstructions(workspaceDir: string): Promise<void> {
  const personalized = claudeTemplate.replace(/__WOLF_BIN__/g, currentBinaryName());
  for (const filename of ['CLAUDE.md', 'AGENTS.md']) {
    await writeIfAbsent(path.join(workspaceDir, filename), personalized);
  }
}
