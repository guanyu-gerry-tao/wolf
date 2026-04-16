import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { input, confirm, select } from '@inquirer/prompts';
import claudeTemplate from './templates/workspace-claude.md';
import { stringify } from 'smol-toml';
import { backupConfig, saveConfig } from '../../utils/config.js';
import { envSet } from '../env/index.js';
import type { AppConfig } from '../../types/index.js';
import type { UserProfile } from '../../types/index.js';
import type { Status } from '../../types/index.js';

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

// Generates the starter resume_pool.md template so the user knows what format to fill in.
function buildResumePoolTemplate(name: string): string {
  return `# Resume Pool — ${name}

<!--
  This is your "everything" resume — wolf reads this and selects the most relevant
  content for each job. Include ALL experience, projects, and skills, even older ones.
  wolf will pick the right subset per application.
-->

## Contact
Name: ${name}
Email:
Phone:
LinkedIn:
GitHub:

## Experience

### Job Title — Company Name
*Month Year – Month Year (or Present)*
- Bullet describing impact or responsibility
- Bullet with metrics if available

## Projects

### Project Name
*Year*
- What it does and what you built

## Education

### Degree — University Name
*Year – Year*

## Skills
TypeScript, Python, SQL, ...
`;
}

/**
 * Interactive setup wizard. Run once in a dedicated workspace directory before
 * using any other wolf command.
 *
 * Creates in the current working directory:
 * - `wolf.toml`                          — workspace config
 * - `profiles/default/profile.toml`      — user profile (identity + job prefs)
 * - `profiles/default/resume_pool.md`    — full experience bank for AI tailoring
 * - `.gitignore`                         — excludes data/ and profiles/
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

  // ── Step 1: Collect profile info ─────────────────────────────────────────
  console.log(`\n${bold('── Profile ──')}`);

  const name = await input({
    message: 'Full name (as on resume):',
    validate: v => v.trim() !== '' || 'Required',
  });
  const email = await input({
    message: 'Email:',
    validate: v => v.includes('@') || 'Invalid email',
  });
  const phone = await input({
    message: 'Phone number:',
    validate: v => v.trim() !== '' || 'Required',
  });

  // Select from common statuses; "Other" allows free-form entry for multi-status
  // situations (e.g. "H-1B + 485 pending") or non-US work authorizations.
  const immigrationStatusRaw = await select({
    message: 'Work authorization status:',
    choices: [
      { name: 'No limit (citizen / GC / EAD)', value: 'no limit' },
      { name: 'H-1B (needs sponsorship)',       value: 'H-1B' },
      { name: 'L1',                             value: 'L1' },
      { name: 'OPT (STEM extension)',           value: 'OPT' },
      { name: 'CPT',                            value: 'CPT' },
      { name: 'Other / multiple statuses',      value: '__other__' },
    ],
  });
  const immigrationStatus = immigrationStatusRaw === '__other__'
    ? await input({
        message: 'Any other status, or multiple statuses:',
        validate: v => v.trim() !== '' || 'Required',
      })
    : immigrationStatusRaw;

  // Optional URLs — empty string collapses to null so the TOML stays clean.
  const firstUrlRaw  = await input({ message: 'LinkedIn URL  (Enter to skip):', default: '' });
  const secondUrlRaw = await input({ message: 'GitHub URL    (Enter to skip):', default: '' });
  const thirdUrlRaw  = await input({ message: 'Website URL   (Enter to skip):', default: '' });

  console.log(`\n${bold('── Job Preferences ──')}`);

  const willingToRelocate = await confirm({ message: 'Willing to relocate?', default: false });
  const targetRolesRaw     = await input({ message: 'Target roles (comma-separated):', default: 'Software Engineer' });
  const targetLocationsRaw = await input({ message: 'Target locations (comma-separated):', default: 'Remote' });

  // ── Step 2: Write wolf.toml ───────────────────────────────────────────────
  const config: AppConfig = {
    defaultProfileId: 'default',
    ai: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    hunt: { minScore: 0.5, maxResults: 50 },
    tailor: { defaultCoverLetterTone: 'professional' },
    reach: { defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
  };
  await saveConfig(config);

  // ── Step 3: Write profiles/default/profile.toml ──────────────────────────
  const profileDir = path.join(process.cwd(), 'profiles', 'default');
  await fs.mkdir(profileDir, { recursive: true });

  const profile: UserProfile = {
    id: 'default',
    label: 'Default',
    name,
    email,
    phone,
    firstUrl:  firstUrlRaw.trim()  || null,
    secondUrl: secondUrlRaw.trim() || null,
    thirdUrl:  thirdUrlRaw.trim()  || null,
    immigrationStatus: immigrationStatus as Status,
    willingToRelocate,
    targetRoles: targetRolesRaw.split(',').map(s => s.trim()).filter(Boolean),
    targetLocations: targetLocationsRaw.split(',').map(s => s.trim()).filter(Boolean),
    scoringNotes: null,
  };

  const profileTomlPath = path.join(profileDir, 'profile.toml');
  const profileExists = await fs.access(profileTomlPath).then(() => true).catch(() => false);
  if (profileExists) {
    console.log(dim('profiles/default/profile.toml already exists — skipping (edit manually to update)'));
  } else {
    await fs.writeFile(profileTomlPath, stringify(profile as unknown as Record<string, unknown>), 'utf-8');
  }

  // ── Step 4: Write profiles/default/resume_pool.md (only if absent) ───────
  const resumePoolPath = path.join(profileDir, 'resume_pool.md');
  const poolExists = await fs.access(resumePoolPath).then(() => true).catch(() => false);
  if (!poolExists) {
    await fs.writeFile(resumePoolPath, buildResumePoolTemplate(name), 'utf-8');
  }

  // ── Step 5: Update .gitignore ─────────────────────────────────────────────
  // Exclude data/ (auto-managed DB) and profiles/ (contains PII) from version control.
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const wolfIgnoreBlock = '\n# wolf\ndata/\nprofiles/\n';
  try {
    const existing = await fs.readFile(gitignorePath, 'utf-8');
    if (!existing.includes('# wolf')) {
      await fs.appendFile(gitignorePath, wolfIgnoreBlock, 'utf-8');
    }
  } catch {
    await fs.writeFile(gitignorePath, wolfIgnoreBlock.trimStart(), 'utf-8');
  }

  // ── Step 6: Write CLAUDE.md and AGENTS.md ────────────────────────────────
  // These tell AI assistants (Claude, OpenClaw, etc.) how to operate in this
  // workspace. Both files share the same content from the bundled template.
  for (const filename of ['CLAUDE.md', 'AGENTS.md']) {
    const dest = path.join(process.cwd(), filename);
    const exists = await fs.access(dest).then(() => true).catch(() => false);
    if (!exists) {
      await fs.writeFile(dest, claudeTemplate, 'utf-8');
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`
${bold('✅ wolf workspace initialized!')}

  ${bold('wolf.toml')}                          — workspace config
  ${bold('profiles/default/profile.toml')}      — your profile (edit to update)
  ${bold('profiles/default/resume_pool.md')}    — fill this in with ALL your experience
  ${bold('data/')}                              — auto-managed database

Next: edit ${bold('profiles/default/resume_pool.md')}, then run:
  wolf add --title "Job Title" --company "Company" --jd-text "paste JD here"
  wolf tailor --job <jobId>
`);

  if (!process.env.WOLF_ANTHROPIC_API_KEY) {
    console.log(`${bold('One more step — set up your API keys.')}\n`);
    await envSet();
  }
}
