import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { confirm, input } from '@inquirer/prompts';

const WOLF_KEYS = [
  'WOLF_ANTHROPIC_API_KEY',
  'WOLF_APIFY_API_TOKEN',
  'WOLF_GMAIL_CLIENT_ID',
  'WOLF_GMAIL_CLIENT_SECRET',
] as const;

type WolfKey = (typeof WOLF_KEYS)[number];

interface KeyInfo {
  prompt: string;
  purpose: string;
  howTo: string;
}

const KEY_INFO: Record<WolfKey, KeyInfo> = {
  WOLF_ANTHROPIC_API_KEY: {
    prompt:  'Anthropic API Key',
    purpose: 'Powers all AI features: job scoring, resume tailoring, email drafting. Required.',
    howTo:   'console.anthropic.com → Sign up → API Keys → Create key',
  },
  WOLF_APIFY_API_TOKEN: {
    prompt:  'Apify API Token',
    purpose: 'Used by job provider integrations that access external services.',
    howTo:   'apify.com → Sign up → Settings → Integrations → API token (free tier available)',
  },
  WOLF_GMAIL_CLIENT_ID: {
    prompt:  'Gmail Client ID',
    purpose: 'Sends cold outreach emails via your Gmail account.',
    howTo:   'console.cloud.google.com → New project → APIs & Services → Credentials → OAuth 2.0 Client ID',
  },
  WOLF_GMAIL_CLIENT_SECRET: {
    prompt:  'Gmail Client Secret',
    purpose: 'Pair with Client ID for Gmail OAuth authentication.',
    howTo:   'Same OAuth 2.0 credential as above',
  },
};

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

/** Mask all but the last 4 characters of a secret value. */
function mask(value: string): string {
  if (value.length <= 4) return '****';
  return '*'.repeat(Math.min(value.length - 4, 12)) + value.slice(-4);
}

/**
 * Detect the shell RC file to write to based on $SHELL.
 * Falls back to ~/.zshrc if unknown.
 */
function detectRcFile(): string {
  const shell = process.env.SHELL ?? '';
  if (shell.includes('bash')) {
    // prefer .bash_profile on Mac, .bashrc on Linux
    return process.platform === 'darwin'
      ? path.join(os.homedir(), '.bash_profile')
      : path.join(os.homedir(), '.bashrc');
  }
  return path.join(os.homedir(), '.zshrc');
}

/**
 * Write or update all WOLF_* keys in the RC file.
 *
 * If a `# wolf API keys` block already exists, the individual lines within it
 * are updated in-place. Otherwise, a new block is appended:
 *
 *   (blank line)
 *   # wolf API keys
 *   export WOLF_ANTHROPIC_API_KEY=...
 *   ...
 *   (blank line)
 */
/** @internal exported for testing */
export async function writeWolfBlock(rcFile: string, entries: { key: string; value: string }[]): Promise<void> {
  let content = '';
  try {
    content = await fs.readFile(rcFile, 'utf-8');
  } catch { /* file doesn't exist yet, will create */ }

  // Update any keys that already exist in the file
  let updated = content;
  const toAppend: { key: string; value: string }[] = [];

  for (const { key, value } of entries) {
    const regex = new RegExp(`^export\\s+${key}=.*$`, 'm');
    if (regex.test(updated)) {
      updated = updated.replace(regex, `export ${key}=${value}`);
    } else {
      toAppend.push({ key, value });
    }
  }

  // Append new keys as a single block
  if (toAppend.length > 0) {
    const block = [
      '',
      '# wolf API keys',
      ...toAppend.map(({ key, value }) => `export ${key}=${value}`),
      '',
    ].join('\n');
    updated = updated.trimEnd() + '\n' + block;
  }

  await fs.writeFile(rcFile, updated, 'utf-8');
}

/**
 * Lists all WOLF_* environment variables and whether they are set.
 * Values are masked for security.
 */
export function envShow(): void {
  console.log(`\n${bold('WOLF_ environment variables:')}\n`);
  for (const key of WOLF_KEYS) {
    const value = process.env[key];
    if (value) {
      console.log(`  ${green('✓')} ${bold(key)}=${mask(value)}`);
    } else {
      console.log(`  ${red('✗')} ${dim(key)}  ${dim('(not set)')}`);
    }
  }
  console.log('');
}

/**
 * Interactively prompts for WOLF_* API keys and writes them to the shell RC file.
 * On Windows, prints manual instructions instead.
 */
export async function envSet(): Promise<void> {
  if (process.platform === 'win32') {
    console.log(`\n${bold('To set WOLF_ keys on Windows:')}`);
    console.log('  1. Open: Settings → System → Advanced system settings → Environment Variables');
    console.log('  2. Add each WOLF_* key to the User section');
    console.log('  3. Restart your terminal\n');
    return;
  }

  const rcFile = detectRcFile();

  // ── Info page ─────────────────────────────────────────────────────────────
  console.log(`
${bold('── API Keys ──')}

API keys are passwords that give wolf access to external services on your behalf.
wolf uses up to 4 keys:

  ${bold('1. WOLF_ANTHROPIC_API_KEY')}  ${red('(required)')}
     ${KEY_INFO.WOLF_ANTHROPIC_API_KEY.purpose}
     Get it: ${dim(KEY_INFO.WOLF_ANTHROPIC_API_KEY.howTo)}
     Cost: pay-per-use, ~$0.01–0.03 per job scored

  ${bold('2. WOLF_APIFY_API_TOKEN')}  ${dim('(optional)')}
     ${KEY_INFO.WOLF_APIFY_API_TOKEN.purpose}
     Get it: ${dim(KEY_INFO.WOLF_APIFY_API_TOKEN.howTo)}

  ${bold('3. WOLF_GMAIL_CLIENT_ID')}  ${dim('(optional)')}
  ${bold('4. WOLF_GMAIL_CLIENT_SECRET')}
     ${KEY_INFO.WOLF_GMAIL_CLIENT_ID.purpose}
     Get it: ${dim(KEY_INFO.WOLF_GMAIL_CLIENT_ID.howTo)}
`);

  await confirm({ message: 'Ready to enter your keys?', default: true });

  console.log(dim(`\nKeys will be written to ${rcFile}. Leave blank to skip.\n`));

  // ── Prompts ───────────────────────────────────────────────────────────────
  const toWrite: { key: string; value: string }[] = [];

  for (const key of WOLF_KEYS) {
    const current = process.env[key];
    const { prompt, purpose, howTo } = KEY_INFO[key];
    console.log(dim(`  ${purpose}`));
    console.log(dim(`  Get it: ${howTo}`));
    const value = await input({
      message: `${prompt}:`,
      ...(current ? { default: current } : { default: '' }),
    });
    if (value.trim()) {
      toWrite.push({ key, value: value.trim() });
    }
    console.log('');
  }

  if (toWrite.length === 0) {
    console.log(dim('\nNo keys entered. Nothing written.\n'));
    return;
  }

  await writeWolfBlock(rcFile, toWrite);
  for (const { key } of toWrite) {
    console.log(`  ${green('✓')} ${key}`);
  }

  console.log(`
${bold('Written to')} ${rcFile}

Restart your terminal to apply, or run:
  ${bold(`source ${rcFile}`)}

Then verify with: ${bold('wolf env show')}
`);
}

/**
 * Non-interactive form of `wolf env set`: write a single WOLF_* key+value to
 * the shell RC file without any prompts. Used by `wolf env set <key> <value>`
 * (mainly for scripts and agents that cannot answer inquirer prompts).
 *
 * `rcFile` is an internal test seam; production callers omit it and let
 * `detectRcFile()` pick the right shell RC.
 */
export async function envSetOne(key: string, value: string, rcFile?: string): Promise<void> {
  if (process.platform === 'win32') {
    console.log(`\n${bold('To set WOLF_ keys on Windows:')}`);
    console.log('  1. Open: Settings → System → Advanced system settings → Environment Variables');
    console.log('  2. Add the WOLF_* key to the User section');
    console.log('  3. Restart your terminal\n');
    return;
  }

  // Reject unknown WOLF_* keys so a typo doesn't silently land in the RC file.
  if (!(WOLF_KEYS as readonly string[]).includes(key)) {
    console.error(`error: unknown key "${key}". Valid: ${WOLF_KEYS.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    console.error(`error: value for ${key} must not be empty`);
    process.exitCode = 1;
    return;
  }

  const target = rcFile ?? detectRcFile();
  await writeWolfBlock(target, [{ key, value: trimmed }]);
  console.log(`\n  ${green('✓')} ${bold(key)} written to ${target}\n`);
  console.log(`Restart your terminal to apply, or run:`);
  console.log(`  ${bold(`source ${target}`)}\n`);
  console.log(`Then verify with: ${bold('wolf env show')}\n`);
}

/** Shell RC files to search, in priority order. */
const RC_FILES = [
  path.join(os.homedir(), '.zshrc'),
  path.join(os.homedir(), '.zprofile'),
  path.join(os.homedir(), '.bash_profile'),
  path.join(os.homedir(), '.bashrc'),
  path.join(os.homedir(), '.profile'),
];

// Matches a shell `export WOLF_...=...` line. Used both to find existing
// entries (envClear preview) and to remove them (envClear action).
const WOLF_EXPORT_LINE_RE = /^export\s+WOLF_/;

/**
 * Removes all WOLF_* export lines from shell RC files and instructs the user
 * to reload their shell. On Windows (no RC files), prints manual instructions.
 */
export async function envClear(): Promise<void> {
  if (process.platform === 'win32') {
    console.log(`\n${bold('To remove WOLF_ keys on Windows:')}`);
    console.log('  1. Open: Settings → System → Advanced system settings → Environment Variables');
    console.log('  2. Delete each WOLF_* variable from the User section\n');
    return;
  }

  // Scan every candidate RC file for `export WOLF_...` lines. Missing files
  // are normal — a user may have only .zshrc or only .bashrc, never both.
  const matches = await findWolfExportsAcrossRcFiles();

  // Bail out with a helpful hint when nothing's there to clean up.
  if (matches.length === 0) {
    console.log('\nNo WOLF_* export lines found in shell RC files.\n');
    console.log(dim('If you set them another way (e.g. /etc/environment), remove them manually.\n'));
    return;
  }

  // Show the user exactly which files and lines will be touched.
  console.log(`\n${bold('Found WOLF_* exports in:')}\n`);
  for (const { file, lines } of matches) {
    console.log(`  ${file}`);
    for (const line of lines) {
      console.log(`    ${dim(line)}`);
    }
  }
  console.log('');

  // Destructive edit — require an explicit confirmation.
  const confirmed = await confirm({
    message: red('Remove all WOLF_* export lines from the files above?'),
    default: false,
  });
  if (!confirmed) {
    console.log('Cancelled.\n');
    return;
  }

  // Rewrite each file with matching lines removed.
  for (const { file } of matches) {
    await removeWolfExportsFromRcFile(file);
    console.log(`  ${green('✓')} Cleaned ${file}`);
  }

  console.log(`
${bold('Done.')} Reload your shell to apply:
  ${bold('source ~/.zshrc')}

Current session still has the keys in memory — open a new terminal to fully clear them.
`);
}

// Returns the RC files that contain at least one `export WOLF_...` line,
// with the matching lines for preview. Missing files are skipped.
async function findWolfExportsAcrossRcFiles(): Promise<{ file: string; lines: string[] }[]> {
  const matches: { file: string; lines: string[] }[] = [];
  for (const rc of RC_FILES) {
    let content: string;
    try {
      content = await fs.readFile(rc, 'utf-8');
    } catch {
      // File doesn't exist — not every user has every RC file.
      continue;
    }
    const wolfLines = content.split('\n').filter((l) => WOLF_EXPORT_LINE_RE.test(l.trim()));
    if (wolfLines.length > 0) {
      matches.push({ file: rc, lines: wolfLines });
    }
  }
  return matches;
}

// Rewrite `file` with every `export WOLF_...` line removed. Non-matching
// lines (comments, non-wolf exports, blank lines) are preserved verbatim.
async function removeWolfExportsFromRcFile(file: string): Promise<void> {
  const content = await fs.readFile(file, 'utf-8');
  const cleaned = content
    .split('\n')
    .filter((l) => !WOLF_EXPORT_LINE_RE.test(l.trim()))
    .join('\n');
  await fs.writeFile(file, cleaned, 'utf-8');
}
