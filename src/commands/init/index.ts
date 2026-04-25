import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { input, confirm, select } from '@inquirer/prompts';
import claudeTemplate from './templates/workspace-claude.md';
import { stringify } from 'smol-toml';
import { backupConfig, saveConfig } from '../../utils/config.js';
import { envSet } from '../env/index.js';
import { assertDevBuildForDevFlag, getEnvValue, resolveWorkspaceDir } from '../../utils/instance.js';
import type { AppConfig } from '../../types/index.js';
import type { UserProfile } from '../../types/index.js';
import type { Status } from '../../types/index.js';

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export interface InitOptions {
  empty?: boolean;
  dev?: boolean;
  here?: boolean;
}

// Generates the starter resume_pool.md template so the user knows what format to fill in.
function buildResumePoolTemplate(name: string): string {
  return `# Resume Pool — ${name}

// This is your "everything" resume — wolf reads this and selects the most relevant
// content for each job. Include ALL experience, projects, and skills, even older ones.
// wolf will pick the right subset per application.
// LINES STARTING WITH // ARE NOTES FOR YOU ONLY — THE AI WILL NOT READ THEM.

// ## Contact
// Your contact info (name, email, phone, LinkedIn, etc.) is NOT stored here.
// To update it, edit: profiles/default/profile.toml


## Experience

// List every role, including short stints and older jobs — wolf picks what's relevant.
// Use strong action verbs and include metrics where possible (e.g. "reduced latency by 40%").

### Job Title — Company Name
*Month Year - Month Year (or Present)*
- Bullet describing impact or responsibility
- Bullet with metrics if available

// ## Projects
// Include personal, open-source, and side projects — not just work projects.
// Mention the tech stack and what problem it solved.

## Projects

### Project Name
*Year*
- What it does, what you built, and what tech you used

## Education

// List degrees in reverse chronological order. Include GPA if 3.5+.
// Relevant coursework is optional but useful for new grads.

### Degree — University Name
*Year - Year*

## Skills
// Comma-separated list. Group loosely by category if helpful (e.g. Languages, Tools, Platforms).
// wolf will reformat this to match the JD's preferred phrasing.

TypeScript, Python, SQL, ...

// ## Certifications (optional)
// Include professional certs: AWS, GCP, Azure, PMP, CFA, etc.
// Add the issuing body and year.

// ## Certifications (optional)
// - AWS Certified Solutions Architect — Amazon, 2024
// - Google Cloud Professional Data Engineer — Google, 2023

// ## Awards & Honors (optional)
// Hackathon wins, academic honors, competitive programming, scholarships.
// Even older awards are worth keeping — wolf will decide if they're relevant.

// ## Awards & Honors (optional)
// - 1st Place — HackMIT 2023
// - Dean's List — University Name, 2019–2021

// ## Publications (optional)
// Research papers, technical blog posts, or articles. Important for ML/research roles.
// Include venue/journal and year.

// ## Publications (optional)
// - "Paper Title" — NeurIPS 2023
// - "Blog Post Title" — Personal blog, 2024 (link)

// ## Open Source (optional)
// Notable contributions beyond your own projects. Include repo links and impact.
// Especially valuable if contributions are to well-known projects.

// ## Open Source (optional)
// - Contributor to facebook/react — fixed hydration bug, 200+ stars on PR
// - Maintainer of your-lib (2.4k stars on GitHub)

// ## Languages (optional)
// Spoken/written languages. Useful for international or customer-facing roles.
// Format: Language (Proficiency level).

// ## Languages (optional)
// - English (Native)
// - Mandarin (Fluent)
// - Spanish (Conversational)

// ## Volunteer (optional)
// Community work, non-profit, or mentoring. Shows character and range.
// Rarely included unless directly relevant or the role values culture-add.

// ## Volunteer (optional)
// - Coding instructor — Code.org, 2022–present

// ## Interests (optional)
// Keep it brief and genuine — avoid generic hobbies like "reading" or "travel".
// Best used when the company culture values personality fit.

// ## Interests (optional)
// Competitive chess, trail running, generative art

// ## Speaking (optional)
// Conference talks, panels, podcasts. More relevant for senior or staff roles.
// Rarely included unless you speak regularly or the role involves evangelism.

// ## Speaking (optional)
// - "Talk Title" — Conference Name, Year
`;
}

function buildDefaultConfig(mode?: 'stable' | 'dev'): AppConfig {
  return {
    ...(mode ? { instance: { mode } } : {}),
    defaultProfileId: 'default',
    hunt: { minScore: 0.5, maxResults: 50 },
    tailor: { model: 'anthropic/claude-sonnet-4-6', defaultCoverLetterTone: 'professional' },
    score: { model: 'anthropic/claude-sonnet-4-6' },
    reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
    fill: { model: 'anthropic/claude-haiku-4-5-20251001' },
  };
}

function buildEmptyProfile(): UserProfile {
  return {
    id: 'default',
    label: 'Default',
    name: '',
    email: '',
    phone: '',
    firstUrl: null,
    secondUrl: null,
    thirdUrl: null,
    immigrationStatus: 'no limit',
    willingToRelocate: 'no',
    targetRoles: [],
    targetLocations: [],
    scoringNotes: null,
  };
}

function serializableProfile(profile: UserProfile): Record<string, unknown> {
  return {
    ...profile,
    firstUrl:     profile.firstUrl     ?? '',
    secondUrl:    profile.secondUrl    ?? '',
    thirdUrl:     profile.thirdUrl     ?? '',
    scoringNotes: profile.scoringNotes ?? '',
  };
}

async function writeWorkspace(options: {
  workspaceDir: string;
  config: AppConfig;
  profile: UserProfile;
  resumePool: string;
  overwriteConfig: boolean;
}): Promise<void> {
  const { workspaceDir, config, profile, resumePool, overwriteConfig } = options;
  await fs.mkdir(workspaceDir, { recursive: true });

  const configPath = path.join(workspaceDir, 'wolf.toml');
  const configExists = await fs.access(configPath).then(() => true).catch(() => false);
  if (!configExists || overwriteConfig) {
    await saveConfig(config, workspaceDir);
  }

  const profileDir = path.join(workspaceDir, 'profiles', 'default');
  await fs.mkdir(profileDir, { recursive: true });
  const profilePath = path.join(profileDir, 'profile.toml');
  const profileExists = await fs.access(profilePath).then(() => true).catch(() => false);
  if (!profileExists || overwriteConfig) {
    await fs.writeFile(profilePath, stringify(serializableProfile(profile)), 'utf-8');
  }

  const resumePoolPath = path.join(profileDir, 'resume_pool.md');
  const resumePoolExists = await fs.access(resumePoolPath).then(() => true).catch(() => false);
  if (!resumePoolExists || overwriteConfig) {
    await fs.writeFile(resumePoolPath, resumePool, 'utf-8');
  }
  await fs.mkdir(path.join(workspaceDir, 'data'), { recursive: true });

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

  for (const filename of ['CLAUDE.md', 'AGENTS.md']) {
    const dest = path.join(workspaceDir, filename);
    const exists = await fs.access(dest).then(() => true).catch(() => false);
    if (!exists) {
      await fs.writeFile(dest, claudeTemplate, 'utf-8');
    }
  }
}

/**
 * Interactive setup wizard. Run once in a dedicated workspace directory before
 * using any other wolf command.
 *
 * Creates in the resolved workspace directory:
 * - `wolf.toml`                          — workspace config
 * - `profiles/default/profile.toml`      — user profile (identity + job prefs)
 * - `profiles/default/resume_pool.md`    — full experience bank for AI tailoring
 * - `.gitignore`                         — excludes data/ and profiles/
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
      profile: buildEmptyProfile(),
      resumePool: '',
      overwriteConfig: false,
    });
    console.log(`Initialized empty workspace at ${workspaceDir}. Run 'wolf profile set <key> <value>' to populate.`);
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
    await backupConfig(workspaceDir);
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

  const willingToRelocate = await select({
    message: 'Willing to relocate?',
    choices: [
      { name: 'No',                    value: 'no' },
      { name: 'Yes',                   value: 'yes' },
      { name: 'Domestic only',         value: 'domestic only' },
      { name: 'Open to relocation',    value: 'open to relocation' },
    ],
  });
  const targetRolesRaw     = await input({ message: 'Target roles (comma-separated):', default: 'Software Engineer' });
  const targetLocationsRaw = await input({ message: 'Target locations (comma-separated):', default: 'Remote' });

  // ── Step 2: Write wolf.toml ───────────────────────────────────────────────
  const config = buildDefaultConfig(options.dev ? 'dev' : undefined);
  await saveConfig(config, workspaceDir);

  // ── Step 3: Write profiles/default/profile.toml ──────────────────────────
  const profileDir = path.join(workspaceDir, 'profiles', 'default');
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
    // Replace null with "" so optional fields always appear in the file.
    await fs.writeFile(profileTomlPath, stringify(serializableProfile(profile)), 'utf-8');
  }

  // ── Step 4: Write profiles/default/resume_pool.md (only if absent) ───────
  const resumePoolPath = path.join(profileDir, 'resume_pool.md');
  const poolExists = await fs.access(resumePoolPath).then(() => true).catch(() => false);
  if (!poolExists) {
    await fs.writeFile(resumePoolPath, buildResumePoolTemplate(name), 'utf-8');
  }

  await fs.mkdir(path.join(workspaceDir, 'data'), { recursive: true });

  // ── Step 5: Update .gitignore ─────────────────────────────────────────────
  // Exclude data/ (auto-managed DB) and profiles/ (contains PII) from version control.
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

  // ── Step 6: Write CLAUDE.md and AGENTS.md ────────────────────────────────
  // These tell AI assistants (Claude, OpenClaw, etc.) how to operate in this
  // workspace. Both files share the same content from the bundled template.
  for (const filename of ['CLAUDE.md', 'AGENTS.md']) {
    const dest = path.join(workspaceDir, filename);
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
  wolf tailor full --job <jobId>
`);

  if (!getEnvValue('ANTHROPIC_API_KEY')) {
    console.log(`${bold('One more step — set up your API keys.')}\n`);
    await envSet();
  }
}
