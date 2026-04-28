import { confirm, input } from '@inquirer/prompts';
import { EnvApplicationServiceImpl } from '../../application/impl/envApplicationServiceImpl.js';

// env commands have no DB / repo dependencies, so we use a module-level
// singleton rather than threading the full AppContext through. The application
// service still owns all logic (rc detection, file mutation, validation);
// this file only formats and prompts.
const envApp = new EnvApplicationServiceImpl();

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

/** Mask all but the last 4 characters of a secret value. */
function mask(value: string): string {
  if (value.length <= 4) return '****';
  return '*'.repeat(Math.min(value.length - 4, 12)) + value.slice(-4);
}

/** @internal exported for testing */
export async function writeWolfBlock(
  rcFile: string,
  entries: { key: string; value: string }[],
): Promise<void> {
  return envApp.writeBlock(rcFile, entries);
}

/**
 * Lists all WOLF_* environment variables and whether they are set.
 * Values are masked for security.
 */
export function envShow(): void {
  console.log(`\n${bold('WOLF_ environment variables:')}\n`);
  for (const { key, value } of envApp.list()) {
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

  const rcFile = envApp.detectRcFile();
  const info = envApp.keyInfo;

  console.log(`
${bold('── API Keys ──')}

API keys are passwords that give wolf access to external services on your behalf.
wolf uses up to 4 keys:

  ${bold('1. WOLF_ANTHROPIC_API_KEY')}  ${red('(required)')}
     ${info.WOLF_ANTHROPIC_API_KEY.purpose}
     Get it: ${dim(info.WOLF_ANTHROPIC_API_KEY.howTo)}
     Cost: pay-per-use, ~$0.01–0.03 per job scored

  ${bold('2. WOLF_APIFY_API_TOKEN')}  ${dim('(optional)')}
     ${info.WOLF_APIFY_API_TOKEN.purpose}
     Get it: ${dim(info.WOLF_APIFY_API_TOKEN.howTo)}

  ${bold('3. WOLF_GMAIL_CLIENT_ID')}  ${dim('(optional)')}
  ${bold('4. WOLF_GMAIL_CLIENT_SECRET')}
     ${info.WOLF_GMAIL_CLIENT_ID.purpose}
     Get it: ${dim(info.WOLF_GMAIL_CLIENT_ID.howTo)}
`);

  await confirm({ message: 'Ready to enter your keys?', default: true });

  console.log(dim(`\nKeys will be written to ${rcFile}. Leave blank to skip.\n`));

  const toWrite: { key: string; value: string }[] = [];

  for (const key of envApp.keys) {
    const current = process.env[key];
    const { prompt, purpose, howTo } = info[key];
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

  await envApp.writeBlock(rcFile, toWrite);
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
 * the shell RC file without any prompts.
 */
export async function envSetOne(key: string, value: string, rcFile?: string): Promise<void> {
  if (process.platform === 'win32') {
    console.log(`\n${bold('To set WOLF_ keys on Windows:')}`);
    console.log('  1. Open: Settings → System → Advanced system settings → Environment Variables');
    console.log('  2. Add the WOLF_* key to the User section');
    console.log('  3. Restart your terminal\n');
    return;
  }

  const result = await envApp.setOne(key, value, rcFile);
  if (!result.ok) {
    console.error(`error: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  const target = result.target!;
  console.log(`\n  ${green('✓')} ${bold(key)} written to ${target}\n`);
  console.log(`Restart your terminal to apply, or run:`);
  console.log(`  ${bold(`source ${target}`)}\n`);
  console.log(`Then verify with: ${bold('wolf env show')}\n`);
}

/**
 * Removes all WOLF_* export lines from shell RC files.
 */
export async function envClear(): Promise<void> {
  if (process.platform === 'win32') {
    console.log(`\n${bold('To remove WOLF_ keys on Windows:')}`);
    console.log('  1. Open: Settings → System → Advanced system settings → Environment Variables');
    console.log('  2. Delete each WOLF_* variable from the User section\n');
    return;
  }

  const matches = await envApp.findExports();

  if (matches.length === 0) {
    console.log('\nNo WOLF_* export lines found in shell RC files.\n');
    console.log(dim('If you set them another way (e.g. /etc/environment), remove them manually.\n'));
    return;
  }

  console.log(`\n${bold('Found WOLF_* exports in:')}\n`);
  for (const { file, lines } of matches) {
    console.log(`  ${file}`);
    for (const line of lines) {
      console.log(`    ${dim(line)}`);
    }
  }
  console.log('');

  const confirmed = await confirm({
    message: red('Remove all WOLF_* export lines from the files above?'),
    default: false,
  });
  if (!confirmed) {
    console.log('Cancelled.\n');
    return;
  }

  await envApp.removeExports(matches.map((m) => m.file));
  for (const { file } of matches) {
    console.log(`  ${green('✓')} Cleaned ${file}`);
  }

  console.log(`
${bold('Done.')} Reload your shell to apply:
  ${bold('source ~/.zshrc')}

Current session still has the keys in memory — open a new terminal to fully clear them.
`);
}
