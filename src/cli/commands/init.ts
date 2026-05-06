import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { confirm } from '@inquirer/prompts';
import { backupConfig } from '../../utils/config.js';
import { envSet } from './env.js';
import { assertDevBuildForDevFlag, getEnvValue, resolveWorkspaceDir, currentBinaryName, isDevBuild } from '../../utils/instance.js';
import { InitApplicationServiceImpl } from '../../application/impl/initApplicationServiceImpl.js';
import { normalizeInitPresetName } from '../../application/impl/initPresets.js';

// init must run in a fresh workspace where wolf.toml does not yet exist, so
// it cannot depend on a fully-wired AppContext (createAppContext loads
// wolf.toml synchronously). The application service has no DB/repo deps —
// a module singleton is sufficient.
const initApp = new InitApplicationServiceImpl();

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export interface InitOptions {
  dev?: boolean;
  here?: boolean;
  preset?: string | true;
}

// Onboarding message printed at the end of an interactive `wolf init`.
function printOnboarding(workspaceDir: string): void {
  const profile = initApp.defaultProfileName;
  console.log(`
${bold('✅ wolf workspace initialized!')}

${bold('What got created:')}
  ${bold('wolf.toml')}                              — workspace config (default = "${profile}")
  ${bold(`profiles/${profile}/profile.md`)}             — identity facts (name, address, demographics, work auth, ...)
  ${bold(`profiles/${profile}/resume_pool.md`)}         — full experience bank (tailor source)
  ${bold(`profiles/${profile}/standard_questions.md`)}  — application-only Q&A + document pointers
  ${bold(`profiles/${profile}/attachments/`)}           — drop transcript / reference letter / portfolio sample etc. here
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
 */
export async function init(options: InitOptions = {}): Promise<void> {
  if (options.dev) assertDevBuildForDevFlag();
  if (options.preset !== undefined && !isDevBuild()) {
    throw new Error('--preset requires a dev build; run `npm run build:dev` then retry from the clone.');
  }
  const requestedPresetName = normalizeInitPresetName(options.preset);
  const presetName = requestedPresetName;
  const mode = options.dev || requestedPresetName !== undefined ? 'dev' : undefined;
  const nonInteractive = requestedPresetName !== undefined;

  const workspaceDir = resolveWorkspaceDir({ here: options.here });

  if (nonInteractive) {
    await initApp.writeWorkspace({
      workspaceDir,
      config: initApp.buildDefaultConfig(mode),
      overwriteConfig: false,
      presetName,
    });
    console.log(`Initialized workspace at ${workspaceDir}.`);
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
  Others can be added later via ${bold(`${currentBinaryName()} env set`)}.

${bold('If you already set them but haven\'t restarted yet:')}
  Restart your terminal, or run: ${bold('source ~/.zshrc')}
  Then verify with: ${bold(`${currentBinaryName()} env show`)}
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
      console.log(`Cancelled. cd to your preferred directory and run ${currentBinaryName()} init again.`);
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
  await initApp.writeWorkspace({
    workspaceDir,
    config: initApp.buildDefaultConfig(mode),
    overwriteConfig,
    presetName,
  });

  // ── Step 2: Onboarding message + optional API key setup ──────────────────
  printOnboarding(workspaceDir);

  if (!getEnvValue('ANTHROPIC_API_KEY')) {
    console.log(`${bold('One more step — set up your API keys.')}\n`);
    await envSet();
  }
}
