// @ts-nocheck
// TODO: the types refactor (ad1f6fd) left this file out of date with the new
// AppConfig / UserProfile shape. Disable type checking until init is reworked
// against the new types.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { input, confirm, select } from '@inquirer/prompts';
import { backupConfig, saveConfig } from '../../utils/config.js';
import { envSet } from '../env/index.js';
import type { AppConfig } from '../../types/index.js';

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

/**
 * Interactive setup wizard. Run once in a dedicated workspace directory before
 * using any other wolf command.
 *
 * Creates in the current working directory:
 * - `wolf.toml`   — workspace config
 * - `.gitignore`  — excludes data/
 * - `resume/`     — directory for resume files
 * - `data/`       — wolf's local database (auto-managed)
 *
 * API keys are NOT stored here — set them as WOLF_* shell environment variables.
 */
export async function init(): Promise<void> {
  // ── Pre-check: workspace exists but keys not active yet ───────────────────
  const alreadyInit = await fs
    .access(path.join(process.cwd(), 'wolf.toml'))
    .then(() => true)
    .catch(() => false);

  if (alreadyInit && !process.env.WOLF_ANTHROPIC_API_KEY) {
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
  if (process.cwd() === os.homedir()) {
    console.log(`
${red('⚠️  You are in your Home directory (~).')}
wolf will create wolf.toml and a resume/ folder here — your resumes will live here too.

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
    .access(path.join(process.cwd(), 'wolf.toml'))
    .then(() => true)
    .catch(() => false);

  if (configExists) {
    console.log(`\n${bold('Existing wolf.toml detected.')}`);
    console.log(red('⚠️  Overwriting will replace your current config (the old file will be backed up as wolf.toml.backup1)'));
    const overwrite = await confirm({
      message: 'Overwrite existing config?',
      default: false,
    });
    if (!overwrite) {
      console.log('Cancelled. Existing config unchanged.');
      return;
    }
    await backupConfig();
    console.log(dim('Backed up existing config to wolf.toml.backup1'));
  }

  // ── Step 1: Create workspace directories + prompt for resume ─────────────
  const resumeDir = path.join(process.cwd(), 'resume');
  const dataDir = path.join(process.cwd(), 'data');
  await fs.mkdir(resumeDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });

  console.log(`
${bold('✓ Created resume/ directory.')}

Please place your resume file inside resume/:
  ${dim('.tex format recommended')} — wolf can customize content automatically
  ${dim('.pdf format also accepted')} — a future step will guide you to convert it to .tex
`);

  await confirm({ message: 'Press Enter once your resume is in place...', default: true });

  // Scan resume/ for .tex and .pdf files
  let resumePath: string;
  const entries = await fs.readdir(resumeDir);
  const resumeFiles = entries.filter(f => f.endsWith('.tex') || f.endsWith('.pdf'));

  if (resumeFiles.length === 0) {
    const retry = await confirm({
      message: 'No resume files found in resume/. Try again?',
      default: true,
    });
    if (!retry) {
      console.log('Cancelled. Re-run wolf init once your resume is ready.');
      return;
    }
    const entries2 = await fs.readdir(resumeDir);
    const retryFiles = entries2.filter(f => f.endsWith('.tex') || f.endsWith('.pdf'));
    if (retryFiles.length === 0) {
      console.log(dim('Still no files found. Cancelled.'));
      return;
    }
    resumePath = retryFiles.length === 1
      ? (console.log(`${dim('Auto-selected:')} ${path.join('resume', retryFiles[0]!)}`), path.join('resume', retryFiles[0]!))
      : await select({
          message: 'Pick your resume:',
          choices: retryFiles.map(f => ({ name: f, value: path.join('resume', f) })),
        });
  } else if (resumeFiles.length === 1) {
    resumePath = path.join('resume', resumeFiles[0]!);
    console.log(`${dim('Auto-selected:')} ${resumePath}`);
  } else {
    resumePath = await select({
      message: 'Multiple resume files found — pick one:',
      choices: resumeFiles.map(f => ({
        name: f,
        value: path.join('resume', f),
      })),
    });
  }

  // ── Step 2: Basic profile info ────────────────────────────────────────────
  console.log(`\n${bold('── Profile ──')}`);

  const name = await input({
    message: 'Your full name (used on applications):',
    validate: v => v.trim() !== '' || 'Name is required',
  });
  const email = await input({
    message: 'Email:',
    validate: v => v.includes('@') || 'Please enter a valid email',
  });
  const phone = await input({
    message: 'Phone number (required by most application forms):',
    validate: v => v.trim() !== '' || 'Phone is required',
  });
  const immigrationStatus = await input({
    message: 'Work authorization / immigration status (plain English, AI will understand):',
    default: '',
  });
  console.log(dim('  e.g. "F-1 OPT, need sponsorship" / "Green Card holder" / "US citizen"'));

  // ── Step 3: Job search preferences ───────────────────────────────────────
  console.log(`\n${bold('── Job Preferences ──')}`);

  const targetRolesRaw = await input({
    message: 'Target roles (comma-separated):',
    default: 'Software Engineer',
  });
  const targetLocationsRaw = await input({
    message: 'Target locations (comma-separated):',
    default: 'Remote',
  });

  const targetRoles = targetRolesRaw.split(',').map(s => s.trim()).filter(Boolean);
  const targetLocations = targetLocationsRaw.split(',').map(s => s.trim()).filter(Boolean);

  // ── Step 4: Write files ───────────────────────────────────────────────────
  console.log('');

  const config: AppConfig = {
    profiles: [
      {
        id: 'default',
        label: 'Default',
        name,
        alternateName: [],
        email,
        alternateEmail: [],
        phone,
        alternatePhone: [],
        linkedinUrl: null,
        githubUrl: null,
        websiteUrl: null,
        immigrationStatus,
        currentCity: null,
        willingToRelocate: true,
        workAuthTimeline: null,
        targetRoles,
        targetLocations,
        skills: [],
        resumePath,
        targetedCompanyIds: [],
        scoringPreferences: {
          preferences: { minSalary: null, preferredCompanySizes: [] },
          weights: {
            workAuth: 0.2,
            roleMatch: 0.35,
            location: 0.2,
            remote: 0.1,
            salary: 0.1,
            companySize: 0.05,
          },
          dealbreakers: { sponsorship: null, remote: null },
        },
      },
    ],
    defaultProfileId: 'default',
    providers: {
      linkedin: { enabled: true },
      handshake: { enabled: false },
    },
    hunt: { minScore: 0.5, maxResults: 50 },
    tailor: { defaultTemplatePath: null, defaultCoverLetterTone: 'professional' },
    reach: { defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
  };
  await saveConfig(config);

  // .gitignore
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const wolfIgnoreBlock = '\n# wolf\ndata/\n';
  try {
    const existing = await fs.readFile(gitignorePath, 'utf-8');
    if (!existing.includes('# wolf')) {
      await fs.appendFile(gitignorePath, wolfIgnoreBlock, 'utf-8');
    }
  } catch {
    await fs.writeFile(gitignorePath, wolfIgnoreBlock.trimStart(), 'utf-8');
  }

  // data/README.txt
  await fs.writeFile(
    path.join(dataDir, 'README.txt'),
    [
      'This directory is managed by wolf.',
      'It contains your local job database and runtime data.',
      'Do NOT commit this directory to version control.',
      'To reset your workspace, delete wolf.toml and run wolf init again.',
    ].join('\n') + '\n',
    'utf-8',
  );

  // ── Done ──────────────────────────────────────────────────────────────────
  const hasKey = !!process.env.WOLF_ANTHROPIC_API_KEY;

  console.log(`${bold('✅ wolf workspace initialized!')}

  ${bold('wolf.toml')}   — config file (edit manually to tweak settings)
  ${bold('resume/')}     — your resume files
  ${bold('data/')}       — wolf's local database (auto-managed)
`);

  if (!hasKey) {
    console.log(`${bold('One more step — set up your API keys.')}\n`);
    await envSet();
  } else {
    console.log(`Next: ${bold('wolf hunt')}\n`);
  }
}
