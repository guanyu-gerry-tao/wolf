#!/usr/bin/env node
import { Command } from 'commander';
import { hunt } from '../commands/hunt/index.js';
import { score } from '../commands/score/index.js';
import { tailor, tailorBrief, tailorResume, tailorCoverLetter } from '../commands/tailor/index.js';
import { fill } from '../commands/fill/index.js';
import { reach } from '../commands/reach/index.js';
import { status, formatStatus } from '../commands/status/index.js';
import { jobList, formatJobList } from '../commands/job/index.js';
import { init } from '../commands/init/index.js';
import { add } from '../commands/add/index.js';
import { envShow, envSet, envClear } from '../commands/env/index.js';
import { configGet, configSet } from '../commands/config/index.js';
import { profileGet, profileSet, profileList, profileCreate, profileUse, profileDelete } from '../commands/profile/index.js';
import { startMcpServer } from '../mcp/server.js';

const program = new Command();

program
  .name('wolf')
  .description('Workflow of Outreaching, LinkedIn & Filling — AI-powered job hunting CLI')
  .version('0.1.0');

program
  .command('init')
  .description('Interactive setup wizard')
  .action(async () => {
    await init();
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
  .description('Find and score jobs')
  .option('-p, --profile <id>', 'Profile to use')
  .option('-r, --role <role>', 'Override target role')
  .option('-l, --location <location>', 'Override target location')
  .option('-n, --max-results <n>', 'Max results to fetch', parseInt)
  .action(async (opts) => {
    const result = await hunt({
      profileId: opts.profile,
      role: opts.role,
      location: opts.location,
      maxResults: opts.maxResults,
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('score')
  .description('Process unscored jobs: extract fields, apply filters, and score via Claude Batch API')
  .option('-p, --profile <id>', 'Profile to use')
  .option('-j, --jobs <ids...>', 'Score only specific job IDs')
  .option('--single', 'Score one job synchronously via Haiku (skips Batch API); requires --jobs with a single ID')
  .option('--poll', 'Poll pending batches for results without submitting new jobs')
  .action(async (opts) => {
    const result = await score({
      profileId: opts.profile,
      jobIds: opts.jobs,
      single: opts.single,
      poll: opts.poll,
    });
    console.log(JSON.stringify(result, null, 2));
  });

const tailorCmd = new Command('tailor')
  .description('Tailor resume + cover letter for a job (runs the full pipeline when called without a subcommand)')
  .option('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .option('--no-cover-letter', 'Skip cover letter in full pipeline')
  .option('--hint <text>', 'Pre-analysis guidance for the analyst (written to hint.md)')
  .option('--diff', 'Show before/after comparison')
  .action(async (opts) => {
    if (!opts.job) throw new Error('tailor: --job <id> is required');
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
  .description('Step 2a: write resume HTML + PDF using the existing brief (requires `wolf tailor brief` first)')
  .requiredOption('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .action(async (opts) => {
    const result = await tailorResume({ jobId: opts.job, profileId: opts.profile });
    console.log(JSON.stringify(result, null, 2));
  });
tailorCmd
  .command('cover')
  .description('Step 2b: write cover letter HTML + PDF using the existing brief (requires `wolf tailor brief` first)')
  .requiredOption('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .action(async (opts) => {
    const result = await tailorCoverLetter({ jobId: opts.job, profileId: opts.profile });
    console.log(JSON.stringify(result, null, 2));
  });
program.addCommand(tailorCmd);

program
  .command('fill')
  .description('Auto-fill a job application form')
  .requiredOption('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .option('--dry-run', 'Preview fields without submitting', true)
  .action(async (opts) => {
    const result = await fill({
      jobId: opts.job,
      profileId: opts.profile,
      dryRun: opts.dryRun,
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('reach')
  .description('Find HR contacts and send outreach emails')
  .requiredOption('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .option('--send', 'Send email after drafting')
  .action(async (opts) => {
    const result = await reach({
      jobId: opts.job,
      profileId: opts.profile,
      send: opts.send,
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command('status')
  .description('Dashboard summary: one count per module (tracked, tailored, applied, ...)')
  .action(async () => {
    const result = await status();
    console.log(formatStatus(result));
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

    const result = await jobList({
      search,
      status: opts.status,
      minScore: opts.minScore,
      start: opts.start,
      end: opts.end,
      source: opts.source,
      limit: opts.limit,
    });

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatJobList(result));
    }
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

const profileCmd = new Command('profile').description('Get or set profile.toml fields by dot-path key');
profileCmd
  .command('get <key>')
  .description('Print value at key (e.g. name, email, targetRoles)')
  .option('-p, --profile <id>', 'Profile ID (defaults to defaultProfileId from wolf.toml)')
  .action(async (key: string, opts: { profile?: string }) => { await profileGet(key, opts.profile); });
profileCmd
  .command('set <key> <value>')
  .description('Set value at key and save profile.toml (arrays accept comma-separated)')
  .option('-p, --profile <id>', 'Profile ID (defaults to defaultProfileId from wolf.toml)')
  .action(async (key: string, value: string, opts: { profile?: string }) => {
    await profileSet(key, value, opts.profile);
  });
profileCmd
  .command('list')
  .description('List all profiles (default marked with *)')
  .action(async () => { await profileList(); });
profileCmd
  .command('create <id>')
  .description('Create a new profile (clones default unless --from is given)')
  .option('-f, --from <src>', 'Source profile to clone from')
  .action(async (id: string, opts: { from?: string }) => { await profileCreate(id, opts); });
profileCmd
  .command('use <id>')
  .description('Set <id> as the default profile in wolf.toml')
  .action(async (id: string) => { await profileUse(id); });
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
  .command('set')
  .description('Interactively set WOLF_* keys and write them to your shell RC file')
  .action(async () => { await envSet(); });
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
