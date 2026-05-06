import fs from 'node:fs/promises';
import path from 'node:path';
import claudeTemplate from './templates/workspace-claude.md';
import agentStableSegment from './templates/agent-stable.md';
import agentDevSegment from './templates/agent-dev.md';
import { profileTomlTemplate } from '../../utils/profileTomlGenerate.js';
import attachmentsReadmeTemplate from './templates/attachments-readme.md';
import { saveConfig } from '../../utils/config.js';
import { DEFAULT_COMPANION_CONFIG, DEFAULT_WORKSPACE_CONFIG } from '../../utils/appConfigDefaults.js';
import { currentBinaryName, isDevBuild } from '../../utils/instance.js';
import { CURRENT_SCHEMA_VERSION } from '../../runtime/migrations/index.js';
import { ensureProfilePromptPack } from '../../utils/profilePromptPack.js';
import { profileTomlForInitPreset } from './initPresets.js';
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
      ...DEFAULT_WORKSPACE_CONFIG,
      companion: DEFAULT_COMPANION_CONFIG,
    };
  }

  /** @inheritdoc */
  async writeWorkspace(options: WriteWorkspaceOptions): Promise<void> {
    const { workspaceDir, config, overwriteConfig, presetName } = options;
    await fs.mkdir(workspaceDir, { recursive: true });

    const configPath = path.join(workspaceDir, 'wolf.toml');
    const configExists = await fs.access(configPath).then(() => true).catch(() => false);
    if (!configExists || overwriteConfig) {
      await saveConfig(config, workspaceDir);
    }

    await writeProfileSkeleton(path.join(workspaceDir, 'profiles', DEFAULT_PROFILE_NAME), presetName);
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
async function writeProfileSkeleton(profileDir: string, presetName?: WriteWorkspaceOptions['presetName']): Promise<void> {
  await fs.mkdir(profileDir, { recursive: true });
  const profileToml = presetName === undefined ? profileTomlTemplate : profileTomlForInitPreset(presetName);
  await writeIfAbsent(path.join(profileDir, 'profile.toml'), profileToml);
  // v3: profile-level scoring guide. Default placeholder is a `> [!TODO]`
  // header that strips out before the AI sees the file (stripComments
  // convention). Idempotent — re-running init does not overwrite.
  await writeIfAbsent(path.join(profileDir, 'score.md'), scoreMdTemplate);
  const attachmentsDir = path.join(profileDir, 'attachments');
  await fs.mkdir(attachmentsDir, { recursive: true });
  await writeIfAbsent(path.join(attachmentsDir, 'README.md'), attachmentsReadmeTemplate);
  await ensureProfilePromptPack(profileDir);
}

// Default content for `profiles/<name>/score.md`. Keep in sync with the
// `SCORE_MD_PLACEHOLDER` constant in fileProfileRepositoryImpl — both are the
// canonical placeholder text. Storing it here too lets `wolf init` write the
// file without depending on the repository.
const scoreMdTemplate = `> [!TODO]
> score.md — profile-level scoring guide.
>
> Wolf merges this file into the score-system prompt on every \`wolf score\`
> invocation. Use it to give long-form steering the AI follows when picking
> a tier (skip / mass_apply / tailor / invest):
>
>   - "I really only want backend infra; PMs and frontend are skip."
>   - "These are the patterns that make me say invest vs tailor."
>   - "Salary below \$130k is tailor, never invest, regardless of stack."
>
> Short preferences (one or two lines) belong in
> profile.toml > [job_preferences].scoring_notes — that field is also fed to
> hunt and tailor. score.md is for longer narrative guidance the score
> command reads.
>
> The whole \`>\` block above is stripped before the file reaches the AI
> (see stripComments). Anything you write below the block is included
> verbatim. Leave the file empty below to run scoring without extra
> guidance.

`;

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
// to edit. Same content; both files written so each agent finds its expected
// name.
//
// Composition: `claudeTemplate` is the build-agnostic skeleton. We append a
// build-specific segment (stable -> "no need to volunteer internals" tone;
// dev -> "append Dev log section" convention). Then `__WOLF_BIN__` is
// substituted across the whole composed string so command examples read
// `wolf init` in stable workspaces and `wolf-dev init` in dev workspaces.
async function ensureAgentInstructions(workspaceDir: string): Promise<void> {
  const buildSegment = isDevBuild() ? agentDevSegment : agentStableSegment;
  const composed = `${claudeTemplate}\n${buildSegment}`;
  const personalized = composed.replace(/__WOLF_BIN__/g, currentBinaryName());
  for (const filename of ['CLAUDE.md', 'AGENTS.md']) {
    await writeIfAbsent(path.join(workspaceDir, filename), personalized);
  }
}
