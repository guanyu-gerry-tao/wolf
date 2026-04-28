import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { confirm } from '@inquirer/prompts';
import claudeTemplate from './templates/workspace-claude.md';
import profileTemplate from './templates/profile.md';
import standardQuestionsTemplate from './templates/standard_questions.md';
import attachmentsReadmeTemplate from './templates/attachments-readme.md';
import resumePoolTemplate from './templates/resume_pool.md';
import { backupConfig, saveConfig } from '../../utils/config.js';
import { envSet } from '../env/index.js';
import { assertDevBuildForDevFlag, getEnvValue, resolveWorkspaceDir } from '../../utils/instance.js';
import type { AppConfig } from '../../utils/types/index.js';

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export interface InitOptions {
  empty?: boolean;
  dev?: boolean;
  here?: boolean;
}

const DEFAULT_PROFILE_NAME = 'default';

function buildDefaultConfig(mode?: 'stable' | 'dev'): AppConfig {
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

// Lays down a fresh workspace skeleton: wolf.toml + default profile dir +
// data/ + .gitignore + AI agent instructions. Idempotent: existing files are
// preserved unless overwriteConfig is true (in which case wolf.toml is replaced
// after a backup; profile content is still preserved).
async function writeWorkspace(options: {
  workspaceDir: string;
  config: AppConfig;
  overwriteConfig: boolean;
}): Promise<void> {
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

// Onboarding message printed at the end of an interactive `wolf init`. The
// content is meant to be copy-pasted (or read out loud) to whichever AI agent
// the user is working with — the agent then walks the user through filling
// each file. We keep this in stdout only (no separate ONBOARDING.md file) so
// the workspace stays minimal.
function printOnboarding(workspaceDir: string): void {
  console.log(`
${bold('✅ wolf workspace initialized!')}

${bold('What got created:')}
  ${bold('wolf.toml')}                              — workspace config (default = "${DEFAULT_PROFILE_NAME}")
  ${bold(`profiles/${DEFAULT_PROFILE_NAME}/profile.md`)}             — identity facts (name, address, demographics, work auth, ...)
  ${bold(`profiles/${DEFAULT_PROFILE_NAME}/resume_pool.md`)}         — full experience bank (tailor source)
  ${bold(`profiles/${DEFAULT_PROFILE_NAME}/standard_questions.md`)}  — application-only Q&A + document pointers
  ${bold(`profiles/${DEFAULT_PROFILE_NAME}/attachments/`)}           — drop transcript / reference letter / portfolio sample etc. here
  ${bold('data/')}                                  — auto-managed database

${bold('Next — fill in your profile:')}
  Open this workspace in Claude Code (or another AI agent) and ask:
    "Help me fill profile.md, resume_pool.md, and standard_questions.md."

  The agent reads ${bold('CLAUDE.md')} and follows its First-time setup section
  to walk you through each file.

  In every template, look for these markers (rendered as styled callout boxes
  in any markdown previewer):
    ${bold('> [!IMPORTANT]')}  — REQUIRED field; you must answer (AI cannot guess)
    ${bold('> [!TIP]')}        — guidance / examples; edit or replace as needed

  Both blockquote types are stripped before reaching the AI, so the visible
  content under each ${bold('## H2')} is what the AI sees.

${dim(`Workspace path: ${workspaceDir}`)}
`);
}

/**
 * Initializes a wolf workspace.
 *
 * Both the interactive path (default) and `--empty` path produce the SAME files
 * — there are no prompts for profile data anymore. The only difference is
 * that `--empty` skips homedir / overwrite warnings (suitable for tests and
 * scripted bootstraps) and skips the API-key setup prompt at the end.
 *
 * Files written under the resolved workspace directory:
 *   - wolf.toml                                — workspace config
 *   - profiles/default/profile.md              — identity (template)
 *   - profiles/default/resume_pool.md          — experience bank (template)
 *   - profiles/default/standard_questions.md   — application Q&A (template)
 *   - profiles/default/attachments/README.md   — explains attachments/
 *   - data/                                    — empty dir for SQLite + workspace artifacts
 *   - .gitignore                               — excludes data/ and profiles/
 *   - CLAUDE.md, AGENTS.md                     — instructions for AI agents
 *
 * API keys are NOT stored here — set them as WOLF_* shell environment variables.
 */
export async function init(options: InitOptions = {}): Promise<void> {
  if (options.dev) assertDevBuildForDevFlag();

  const workspaceDir = resolveWorkspaceDir({ here: options.here });

  if (options.empty) {
    await writeWorkspace({
      workspaceDir,
      config: buildDefaultConfig(options.dev ? 'dev' : undefined),
      overwriteConfig: false,
    });
    console.log(`Initialized empty workspace at ${workspaceDir}.`);
    return;
  }

  // ── Pre-check: workspace exists but keys not active yet ───────────────────
  const alreadyInit = await fs
    .access(path.join(workspaceDir, 'wolf.toml'))
    .then(() => true)
    .catch(() => false);

  if (alreadyInit && !getEnvValue('ANTHROPIC_API_KEY')) {
    const missing = ['WOLF_ANTHROPIC_API_KEY', 'WOLF_APIFY_API_TOKEN', 'WOLF_GMAIL_CLIENT_ID', 'WOLF_GMAIL_CLIENT_SECRET']
      .filter(k => !process.env[k]);

    console.log(`
${bold('wolf.toml found — workspace already initialized.')}

The following keys are not set in your current environment:
${missing.map(k => `  ${red('✗')} ${k}`).join('\n')}

${bold("If you don't need all of them:")}
  Only ${bold('WOLF_ANTHROPIC_API_KEY')} is required to get started.
  Others can be added later via ${bold('wolf env set')}.

${bold('If you already set them but haven\'t restarted yet:')}
  Restart your terminal, or run: ${bold('source ~/.zshrc')}
  Then verify with: ${bold('wolf env show')}
`);
    const setupNow = await confirm({
      message: 'Set up missing keys now?',
      default: true,
    });
    if (setupNow) await envSet();
    return;
  }

  // ── Step 0a: Warn if running in home directory ────────────────────────────
  if (workspaceDir === os.homedir()) {
    console.log(`
${red('⚠️  You are in your Home directory (~).')}
wolf will create wolf.toml and a profiles/ folder here — your profile data will live here too.

Consider cd-ing to a dedicated folder first, e.g.:
  ${dim('mkdir ~/Documents/job-search && cd ~/Documents/job-search')}
`);

    const proceed = await confirm({
      message: 'Continue initializing here anyway?',
      default: false,
    });
    if (!proceed) {
      console.log('Cancelled. cd to your preferred directory and run wolf init again.');
      return;
    }
  }

  // ── Step 0b: Check for existing wolf.toml ────────────────────────────────
  const configExists = await fs
    .access(path.join(workspaceDir, 'wolf.toml'))
    .then(() => true)
    .catch(() => false);

  let overwriteConfig = false;
  if (configExists) {
    console.log(`\n${bold('Existing wolf.toml detected.')}`);
    console.log(red('⚠️  Overwriting will replace your current config (the old file will be backed up as wolf.toml.backup1)'));
    overwriteConfig = await confirm({
      message: 'Overwrite existing config?',
      default: false,
    });
    if (!overwriteConfig) {
      console.log('Cancelled. Existing config unchanged.');
      return;
    }
    await backupConfig(workspaceDir);
    console.log(dim('Backed up existing config to wolf.toml.backup1'));
  }

  // ── Step 1: Write workspace files ────────────────────────────────────────
  await writeWorkspace({
    workspaceDir,
    config: buildDefaultConfig(options.dev ? 'dev' : undefined),
    overwriteConfig,
  });

  // ── Step 2: Onboarding message + optional API key setup ──────────────────
  printOnboarding(workspaceDir);

  if (!getEnvValue('ANTHROPIC_API_KEY')) {
    console.log(`${bold('One more step — set up your API keys.')}\n`);
    await envSet();
  }
}
