import fs from 'node:fs/promises';
import path from 'node:path';
import claudeTemplate from './templates/workspace-claude.md';
import profileTemplate from './templates/profile.md';
import standardQuestionsTemplate from './templates/standard_questions.md';
import attachmentsReadmeTemplate from './templates/attachments-readme.md';
import resumePoolTemplate from './templates/resume_pool.md';
import { saveConfig } from '../../utils/config.js';
import type { AppConfig } from '../../utils/types/index.js';
import type {
  InitApplicationService,
  WriteWorkspaceOptions,
} from '../initApplicationService.js';

const DEFAULT_PROFILE_NAME = 'default';

export class InitApplicationServiceImpl implements InitApplicationService {
  readonly defaultProfileName = DEFAULT_PROFILE_NAME;

  buildDefaultConfig(mode?: 'stable' | 'dev'): AppConfig {
    return {
      ...(mode ? { instance: { mode } } : {}),
      default: DEFAULT_PROFILE_NAME,
      hunt: { minScore: 0.5, maxResults: 50 },
      tailor: { model: 'anthropic/claude-sonnet-4-6', defaultCoverLetterTone: 'professional' },
      score: { model: 'anthropic/claude-sonnet-4-6' },
      reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
      fill: { model: 'anthropic/claude-haiku-4-5-20251001' },
    };
  }

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

// Writes the four template files that compose a fresh profile directory plus
// the attachments/ subfolder. No file is overwritten if it already exists —
// re-running `wolf init` is safe.
async function writeProfileSkeleton(profileDir: string): Promise<void> {
  await fs.mkdir(profileDir, { recursive: true });
  await writeIfAbsent(path.join(profileDir, 'profile.md'), profileTemplate);
  await writeIfAbsent(path.join(profileDir, 'standard_questions.md'), standardQuestionsTemplate);
  await writeIfAbsent(path.join(profileDir, 'resume_pool.md'), resumePoolTemplate);
  const attachmentsDir = path.join(profileDir, 'attachments');
  await fs.mkdir(attachmentsDir, { recursive: true });
  await writeIfAbsent(path.join(attachmentsDir, 'README.md'), attachmentsReadmeTemplate);
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
async function ensureAgentInstructions(workspaceDir: string): Promise<void> {
  for (const filename of ['CLAUDE.md', 'AGENTS.md']) {
    await writeIfAbsent(path.join(workspaceDir, filename), claudeTemplate);
  }
}
