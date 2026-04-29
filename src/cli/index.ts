#!/usr/bin/env node
import { Command } from 'commander';
import updateNotifier from 'update-notifier';
// hunt / score / fill / reach are not yet implemented — registered with
// stub action handlers via notYetMessage() rather than imported here. When
// each milestone lands, re-import its command function and replace the stub.
import { tailor, tailorBrief, tailorResume, tailorCoverLetter } from './commands/tailor.js';
import { status, formatStatus } from './commands/status.js';
import { doctor, formatDoctor } from './commands/doctor.js';
import { runJobListCli } from './commands/job/index.js';
import { init } from './commands/init.js';
import { add } from './commands/add.js';
import { envShow, envSet, envSetOne, envClear } from './commands/env.js';
import { configGet, configSet } from './commands/config.js';
import { profileList, profileCreate, profileUse, profileDelete } from './commands/profile.js';
import { migrate } from './commands/migrate.js';
import { startMcpServer } from '../mcp/server.js';
import { DEV_WARNING, isDevBuild, currentBinaryName } from '../utils/instance.js';
import { MissingApiKeyError, MissingChromiumError, WorkspaceNotInitializedError } from '../utils/errors/index.js';
import { statusTag, notYetMessage } from '../utils/commandStatus.js';

const program = new Command();

if (isDevBuild()) {
  console.error(DEV_WARNING);
}

// Stable builds notify the user when a newer @gerryt/wolf is on npm. The
// library caches the last check in ~/.config/configstore/ and forks the RTT
// to a child process, so this call is non-blocking and only hits the network
// roughly once per `updateCheckInterval`. Skip in dev builds — devs run from
// a clone, not from npm.
if (!isDevBuild()) {
  // Inline the package metadata that `update-notifier` needs. We avoid an
  // `import * from '../../package.json'` because tsup bundles to dist/cli/
  // and the relative path would not survive bundling cleanly.
  updateNotifier({
    pkg: { name: '@gerryt/wolf', version: '0.1.0' },
    updateCheckInterval: 1000 * 60 * 60 * 24,
  }).notify({ defer: false });
}

// Top-level catch: render typed errors as a single clean stderr line + exit 1
// rather than dumping a Node stack trace at the user. Anything we don't
// recognise rethrows so the default unhandled-rejection path still surfaces
// real bugs.
process.on('uncaughtException', renderError);
process.on('unhandledRejection', renderError);
function renderError(err: unknown): void {
  if (err instanceof MissingApiKeyError) {
    process.stderr.write(`wolf: ${err.message}\n`);
    process.exit(1);
  }
  if (err instanceof MissingChromiumError) {
    process.stderr.write(`wolf: ${err.message}\n`);
    process.exit(1);
  }
  if (err instanceof WorkspaceNotInitializedError) {
    // Use a top + bottom banner so a non-technical user can immediately see
    // this is a "you need to do something" message, not a wolf crash.
    const bar = '='.repeat(64);
    process.stderr.write(
      `\n${bar}\n` +
      `  wolf: workspace not initialized\n\n` +
      `  Path checked:  ${err.workspacePath}\n` +
      `  Init command:  ${err.initCommand}\n\n` +
      `  Set ${err.envVarName} to use a different directory.\n` +
      `${bar}\n\n`,
    );
    process.exit(1);
  }
  // Unknown — let Node's default handler print the stack and exit non-zero.
  throw err;
}

// Bin name reflects which binary the user actually invoked (`wolf` for stable,
// `wolf-dev` for dev builds), so `--help` and subcommand `--help` echo back
// the exact command they typed.
program
  .name(currentBinaryName())
  .description('Workflow of Outreaching, LinkedIn & Filling — AI-powered job hunting CLI')
  .version('0.1.0');

program
  .command('init')
  .description('Interactive setup wizard')
  .option('--empty', 'Non-interactive: create skeleton only, no prompts')
  .option('--dev', 'Create a dev workspace (requires npm run build:dev)')
  .option('--here', 'Create the workspace in the current directory')
  .action(async (opts) => {
    await init({ empty: opts.empty, dev: opts.dev, here: opts.here });
  });

program
  .command('add')
  .description('Add a job manually')
  .requiredOption('-t, --title <title>', 'Job title')
  .requiredOption('-c, --company <company>', 'Company name')
  .requiredOption('-j, --jd-text <text>', 'Job description text')
  .option('-u, --url <url>', 'Original job posting URL')
  .option('-p, --profile <id>', 'Profile to use')
  .action(async (opts) => {
    const result = await add({
      title: opts.title,
      company: opts.company,
      jdText: opts.jdText,
      url: opts.url,
      profileId: opts.profile,
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('hunt')
  .description('Find and score jobs' + statusTag('hunt'))
  .option('-p, --profile <id>', 'Profile to use')
  .option('-r, --role <role>', 'Override target role')
  .option('-l, --location <location>', 'Override target location')
  .option('-n, --max-results <n>', 'Max results to fetch', parseInt)
  .action(async (_opts) => {
    process.stderr.write(notYetMessage('hunt') + '\n');
    process.exit(1);
  });

program
  .command('score')
  .description('Process unscored jobs: extract fields, apply filters, and score via Claude Batch API' + statusTag('score'))
  .option('-p, --profile <id>', 'Profile to use')
  .option('-j, --jobs <ids...>', 'Score only specific job IDs')
  .option('--single', 'Score one job synchronously via Haiku (skips Batch API); requires --jobs with a single ID')
  .option('--poll', 'Poll pending batches for results without submitting new jobs')
  .action(async (_opts) => {
    process.stderr.write(notYetMessage('score') + '\n');
    process.exit(1);
  });

const tailorCmd = new Command('tailor')
  .description('Tailor resume + cover letter for a job (run a phase or the full pipeline as a subcommand)');
tailorCmd
  .command('full')
  .description('Run the full 3-agent pipeline: analyst brief -> resume + cover letter (parallel)')
  .requiredOption('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .option('--no-cover-letter', 'Skip cover letter')
  .option('--hint <text>', 'Pre-analysis guidance for the analyst (written to hint.md)')
  .option('--diff', 'Show before/after comparison')
  .action(async (opts) => {
    const result = await tailor({
      jobId: opts.job,
      profileId: opts.profile,
      coverLetter: opts.coverLetter,
      hint: opts.hint,
      diff: opts.diff,
    });
    console.log(JSON.stringify(result, null, 2));
  });
tailorCmd
  .command('brief')
  .description('Step 1: produce the tailoring brief only (writes data/jobs/<dir>/src/tailoring-brief.md)')
  .requiredOption('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .option('--hint <text>', 'Pre-analysis guidance for the analyst (written to hint.md)')
  .action(async (opts) => {
    const result = await tailorBrief({
      jobId: opts.job,
      profileId: opts.profile,
      hint: opts.hint,
    });
    console.log(JSON.stringify(result, null, 2));
  });
tailorCmd
  .command('resume')
  .description(`Step 2a: write resume HTML + PDF using the existing brief (requires \`${currentBinaryName()} tailor brief\` first)`)
  .requiredOption('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .action(async (opts) => {
    const result = await tailorResume({ jobId: opts.job, profileId: opts.profile });
    console.log(JSON.stringify(result, null, 2));
  });
tailorCmd
  .command('cover')
  .description(`Step 2b: write cover letter HTML + PDF using the existing brief (requires \`${currentBinaryName()} tailor brief\` first)`)
  .requiredOption('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .action(async (opts) => {
    const result = await tailorCoverLetter({ jobId: opts.job, profileId: opts.profile });
    console.log(JSON.stringify(result, null, 2));
  });
program.addCommand(tailorCmd);

program
  .command('fill')
  .description('Auto-fill a job application form' + statusTag('fill'))
  .requiredOption('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .option('--dry-run', 'Preview fields without submitting', true)
  .action(async (_opts) => {
    process.stderr.write(notYetMessage('fill') + '\n');
    process.exit(1);
  });

program
  .command('reach')
  .description('Find HR contacts and send outreach emails' + statusTag('reach'))
  .requiredOption('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .option('--send', 'Send email after drafting')
  .action(async (_opts) => {
    process.stderr.write(notYetMessage('reach') + '\n');
    process.exit(1);
  });

program
  .command('status')
  .description('Dashboard summary: one count per module (tracked, tailored, applied, ...)')
  .action(async () => {
    const result = await status();
    console.log(formatStatus(result));
  });

program
  .command('doctor')
  .description('Check whether the default profile is filled enough for tailor / fill / reach to run')
  .action(async () => {
    const report = await doctor();
    console.log(formatDoctor(report));
    if (!report.ready) process.exitCode = 1;
  });

program
  .command('migrate')
  .description('Upgrade this workspace to the binary\'s current schema version')
  .option('--dry-run', 'Print the migration plan without applying any change')
  .action(async (opts) => {
    await migrate({ dryRun: opts.dryRun });
  });

// Commander's collector for repeatable flags. Each occurrence of --search
// appends one term to the accumulator. Needs to live at module scope so the
// initial empty array is captured per option definition.
function collectSearchTerms(value: string, previous: string[]): string[] {
  return [...previous, value];
}

const jobCmd = new Command('job').description('Inspect tracked jobs');
jobCmd
  .command('list')
  .description(
    'List tracked jobs with filters. Default limit 20. ' +
      'Use --search (repeatable) for free-form substring match; ' +
      '--status / --min-score / --source for structured filters; ' +
      '--start / --end for time range; --json for machine-readable output.',
  )
  .option(
    '--search <text>',
    'Substring search across title, company name, and location. ' +
      'Repeatable — multiple terms are OR\'d. ' +
      'Terms are matched as SQL LIKE patterns — we wrap your input as %<term>%, ' +
      'so `%` and `_` in the term act as wildcards ' +
      '(`%` = any sequence, `_` = exactly one character). ' +
      'Useful for AI callers; human users rarely need to care.',
    collectSearchTerms,
    [],
  )
  .option('-s, --status <status>', 'Filter by status (e.g. new, applied, interview)')
  .option('--min-score <n>', 'Filter by minimum score', parseFloat)
  .option('--start <date>', 'Lower bound on createdAt (ISO 8601 or YYYY-MM-DD)')
  .option('--end <date>', 'Upper bound on createdAt (ISO 8601 or YYYY-MM-DD)')
  .option('--source <source>', 'Filter by source (LinkedIn, Indeed, ...)')
  .option('-n, --limit <n>', 'Maximum rows to show (default 20)', (v) => parseInt(v, 10))
  .option('--json', 'Machine-readable output')
  .action(async (opts) => {
    // Normalize --search: the collector defaults to [] even when no flag is
    // given, but passing an empty array through to the repo is wasted work,
    // so we hand `undefined` through to keep JobQuery's contract clean.
    const search: string[] | undefined = opts.search.length > 0 ? opts.search : undefined;

    // Delegate to the CLI wrapper so validation errors are rendered as a
    // single stderr line + non-zero exit code instead of an unhandled
    // promise rejection (which would dump a Node stack trace).
    await runJobListCli(
      {
        search,
        status: opts.status,
        minScore: opts.minScore,
        start: opts.start,
        end: opts.end,
        source: opts.source,
        limit: opts.limit,
      },
      Boolean(opts.json),
    );
  });
program.addCommand(jobCmd);

const configCmd = new Command('config').description('Get or set wolf.toml fields by dot-path key');
configCmd
  .command('get <key>')
  .description('Print value at key (e.g. tailor.model, hunt.minScore)')
  .action(async (key: string) => { await configGet(key); });
configCmd
  .command('set <key> <value>')
  .description('Set value at key and save wolf.toml (coerced to the field\'s current type)')
  .action(async (key: string, value: string) => { await configSet(key, value); });
program.addCommand(configCmd);

// Profile fields are stored as markdown — edit profiles/<name>/profile.md
// directly with $EDITOR, no get/set CLI to keep the API surface small.
const profileCmd = new Command('profile').description('Manage profile directories');
profileCmd
  .command('list')
  .description('List all profile directories (default marked with *)')
  .action(async () => { await profileList(); });
profileCmd
  .command('create <name>')
  .description('Create a new profile directory (clones default unless --from is given)')
  .option('-f, --from <src>', 'Source profile to clone from')
  .action(async (name: string, opts: { from?: string }) => { await profileCreate(name, opts); });
profileCmd
  .command('use <name>')
  .description('Set <name> as the default profile in wolf.toml')
  .action(async (name: string) => { await profileUse(name); });
profileCmd
  .command('delete <id>')
  .description('Delete profile directory (requires --yes)')
  .option('-y, --yes', 'Confirm deletion')
  .action(async (id: string, opts: { yes?: boolean }) => { await profileDelete(id, opts); });
program.addCommand(profileCmd);

const envCmd = new Command('env').description('Manage WOLF_ environment variables (API keys)');
envCmd
  .command('show')
  .description('List all WOLF_* keys and whether they are set (values masked)')
  .action(() => { envShow(); });
envCmd
  .command('set [key] [value]')
  .description('Set WOLF_* keys in your shell RC file. With no args, runs interactive setup; with <key> <value>, writes that one key non-interactively.')
  .action(async (key?: string, value?: string) => {
    if (key && value) {
      await envSetOne(key, value);
    } else if (!key && !value) {
      await envSet();
    } else {
      console.error('error: provide both <key> and <value>, or neither (for interactive mode)');
      process.exitCode = 1;
    }
  });
envCmd
  .command('clear')
  .description('Remove all WOLF_* export lines from shell RC files')
  .action(async () => { await envClear(); });
program.addCommand(envCmd);

const mcp = new Command('mcp').description('MCP server commands');
mcp
  .command('serve')
  .description('Start the MCP server')
  .action(async () => {
    await startMcpServer();
  });

program.addCommand(mcp);

program.parse();
