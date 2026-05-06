#!/usr/bin/env node
import { Command } from 'commander';
import updateNotifier from 'update-notifier';
// hunt / fill / reach are not yet implemented — registered with stub action
// handlers via notYetMessage() rather than imported here. When each milestone
// lands, re-import its command function and replace the stub.
import { tailor, tailorBrief, tailorResume, tailorCoverLetter } from './commands/tailor.js';
import { score, formatScoreResult, type ScoreMode } from './commands/score.js';
import { status, formatStatus } from './commands/status.js';
import { doctor, formatDoctor } from './commands/doctor.js';
import { runJobListCli, jobShow, jobGet, jobSet, jobFields } from './commands/job/index.js';
import { init } from './commands/init.js';
import { add } from './commands/add.js';
import { envShow, envSet, envSetOne, envClear } from './commands/env.js';
import { configGet, configSet } from './commands/config.js';
import {
  profileList, profileCreate, profileUse, profileDelete,
  profileShow, profileGet, profileSet, profileAdd, profileAddQuestion, profileRemove, profileFields,
  profilePromptsList, profilePromptsPath, profilePromptsRepair,
  profileScoreShow, profileScoreEdit, profileScoreInit,
} from './commands/profile.js';
import { migrate } from './commands/migrate.js';
import { context } from './commands/context.js';
import { serve } from './commands/serve.js';
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
  .description('Score unscored jobs against your profile via Claude Batch API' + statusTag('score'))
  .option('-p, --profile <id>', 'Profile to use')
  .option('-j, --jobs <ids...>', 'Score (or re-score) only specific job IDs')
  .option('--single', 'Score one job synchronously (no Batch API); useful for inline previews')
  .option('--poll', 'Drain pending score batches and write results back; submits no new jobs')
  .option('--ai-model <provider/model>', 'Override score.model from wolf.toml, e.g. anthropic/claude-haiku-4-5-20251001')
  .action(async (opts) => {
    // Wrap the call so plain `Error` thrown by the scoring stack (parse
    // failures, "no candidate jobs", etc.) renders as a clean stderr line +
    // exit 1, rather than bubbling into Node's default unhandled-rejection
    // path which prints a stack trace and exits with code 7.
    try {
      const result = await score({
        profileId: opts.profile,
        jobIds: opts.jobs,
        single: Boolean(opts.single),
        poll: Boolean(opts.poll),
        aiModel: opts.aiModel,
      });
      const mode: ScoreMode = opts.poll ? 'poll' : opts.single ? 'single' : 'default';
      console.log(formatScoreResult(result, mode));
    } catch (err) {
      // Typed errors (MissingApiKeyError, WorkspaceNotInitializedError) are
      // already handled by the global renderError handler — re-throw so they
      // get the banner treatment. Plain Error gets the one-line render here.
      if (
        err instanceof MissingApiKeyError ||
        err instanceof WorkspaceNotInitializedError ||
        err instanceof MissingChromiumError
      ) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`wolf score: ${message}\n`);
      process.exit(1);
    }
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

program
  .command('context')
  .description('Print AI-prompt-friendly context for a scenario (search-time agent / tailor wrapper)')
  .requiredOption('--for <scenario>', 'Scenario: search | tailor')
  .action(async (opts: { for: string }) => {
    if (opts.for !== 'search' && opts.for !== 'tailor') {
      throw new Error(`Unknown --for value "${opts.for}". Allowed: search / tailor.`);
    }
    await context(opts.for);
  });

program
  .command('serve')
  .description('Start the local HTTP daemon for the wolf companion extension')
  .option('-p, --port <port>', 'Port to listen on (default 47823)', parsePort)
  .option('--no-browser', 'Do not launch the Wolf Browser window')
  .action(async (opts: { port?: number; browser?: boolean }) => {
    await serve({ port: opts.port, browser: opts.browser });
  });

// Commander's collector for repeatable flags. Each occurrence of --search
// appends one term to the accumulator. Needs to live at module scope so the
// initial empty array is captured per option definition.
function collectSearchTerms(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port "${value}". Expected 1-65535.`);
  }
  return port;
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
// `wolf job show <id>` — print every column + JD prose.
jobCmd
  .command('show')
  .description('Print all fields of a job by id, plus its JD prose.')
  .argument('<id>', 'Job id (uuid)')
  .option('--json', 'Machine-readable output')
  .action(async (id: string, opts: { json?: boolean }) => {
    await jobShow(id, opts);
  });

// `wolf job get <id> <field>` — pipe-friendly single-field read.
jobCmd
  .command('get')
  .description('Read one field of a job by id.')
  .argument('<id>', 'Job id (uuid)')
  .argument('<field>', 'Field name (e.g. status, score, description_md)')
  .action(async (id: string, field: string) => {
    await jobGet(id, field);
  });

// `wolf job set <id> <field> [value]` — surgical update; --from-file for prose.
jobCmd
  .command('set')
  .description('Update one field of a job. `--from-file` reads multiline values from disk.')
  .argument('<id>', 'Job id (uuid)')
  .argument('<field>', 'Field name (e.g. status, score, description_md)')
  .argument('[value]', 'Value (use --from-file for long prose or shell-quoting-hostile values)')
  .option('--from-file <path>', 'Read the value from a file instead of the CLI arg')
  .action(async (id: string, field: string, value: string | undefined, opts: { fromFile?: string }) => {
    await jobSet(id, field, value, opts);
  });

// `wolf job fields [name]` — schema reference for humans / AI.
jobCmd
  .command('fields')
  .description('Print the field reference. Pass [name] to detail one field.')
  .argument('[name]', 'Optional field name; prints just that field if given')
  .option('--required', 'Only list REQUIRED fields')
  .option('--json', 'Machine-readable output')
  .action(async (name: string | undefined, opts: { required?: boolean; json?: boolean }) => {
    await jobFields(name, opts);
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

// Profile data lives in profiles/<name>/profile.toml (v2). All writes
// go through wolf commands so comments / formatting are preserved by the
// surgical TOML editor (smol-toml's stringify() drops comments).
const profileCmd = new Command('profile').description('Manage profile directories and fields');
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
profileCmd
  .command('show')
  .description('Print profile.toml verbatim (raw, with comments). Use `wolf context --for=search` for AI-prompt context.')
  .action(async () => { await profileShow(); });
profileCmd
  .command('get <key>')
  .description('Read a single field by dot-path (e.g. contact.email, question.tell_me_about_failure.answer)')
  .action(async (key: string) => { await profileGet(key); });
profileCmd
  .command('set <key> [value]')
  .description('Write a field; surgical edit preserves comments. Use --from-file for long values, multi-line content, or values starting with "-" (commander treats those as flags).')
  .option('--from-file <path>', 'Read the value from a file instead of the CLI argument')
  .action(async (key: string, value: string | undefined, opts: { fromFile?: string }) => {
    await profileSet(key, value, opts);
  });
profileCmd
  .command('add <type>')
  .description(
    'Add a new entry. <type> = experience / project / education / question. ' +
    'For experience/project/education use --slug-from "<text>" for AI-friendly id generation. ' +
    'For question use --prompt "<question>" and optionally --answer "<text>".',
  )
  .option('--id <id>', 'Explicit id (slug-style)')
  .option('--slug-from <text>', '(experience/project/education) Free-form description; wolf slugifies into an id')
  .option('--prompt <text>', '(question only) The question text — also the source of the slug-id')
  .option('--answer <text>', '(question only) Pre-fill the answer answer')
  .option('--prompt-from-file <path>', '(question only) Read --prompt from a file')
  .option('--answer-from-file <path>', '(question only) Read --answer from a file')
  .action(async (type: string, opts: {
    id?: string;
    slugFrom?: string;
    prompt?: string;
    answer?: string;
    promptFromFile?: string;
    answerFromFile?: string;
  }) => {
    if (type === 'question') {
      await profileAddQuestion({
        prompt: opts.prompt,
        answer: opts.answer,
        promptFromFile: opts.promptFromFile,
        answerFromFile: opts.answerFromFile,
        id: opts.id,
      });
      return;
    }
    if (type !== 'experience' && type !== 'project' && type !== 'education') {
      throw new Error(`Unknown type "${type}". Allowed: experience / project / education / question.`);
    }
    await profileAdd(type, { id: opts.id, slugFrom: opts.slugFrom });
  });
profileCmd
  .command('remove <type> <id>')
  .description('Remove a resume entry by id. Builtin questions cannot be removed (clear answer instead).')
  .option('-y, --yes', 'Confirm removal (typo guard)')
  .action(async (type: string, id: string, opts: { yes?: boolean }) => {
    if (type !== 'experience' && type !== 'project' && type !== 'education' && type !== 'question') {
      throw new Error(`Unknown type "${type}". Allowed: experience / project / education / question.`);
    }
    await profileRemove(type, id, opts);
  });
profileCmd
  .command('fields [path]')
  .description('Print field reference for profile.toml. With [path], prints just that field. --required / --json supported.')
  .option('--required', 'Only list REQUIRED fields')
  .option('--json', 'Output JSON for AI / MCP consumers')
  .action(async (pathArg: string | undefined, opts: { required?: boolean; json?: boolean }) => {
    await profileFields(pathArg, opts);
  });
const profilePromptsCmd = new Command('prompts')
  .description('Inspect or repair the active profile prompt-pack skeleton');
profilePromptsCmd
  .command('path')
  .description('Print profiles/<name>/prompts path')
  .action(async () => { await profilePromptsPath(); });
profilePromptsCmd
  .command('list')
  .description('List prompt-pack files and whether each is empty, custom, or missing')
  .option('--json', 'Output JSON for AI / MCP consumers')
  .action(async (opts: { json?: boolean }) => { await profilePromptsList(opts); });
profilePromptsCmd
  .command('repair')
  .description('Create missing prompt-pack files without overwriting edits')
  .action(async () => { await profilePromptsRepair(); });
profileCmd.addCommand(profilePromptsCmd);

// `wolf profile score *` — long-form scoring guide that augments the
// score-system prompt with profile-level steering. Mirrors the
// `wolf profile prompts` shape (path / show / edit / init).
const profileScoreCmd = new Command('score')
  .description('Show, edit, or initialize the profile-level scoring guide (profiles/<name>/score.md)');
profileScoreCmd
  .command('show')
  .description('Print profiles/<active>/score.md to stdout')
  .action(async () => { await profileScoreShow(); });
profileScoreCmd
  .command('edit')
  .description('Open profiles/<active>/score.md in $EDITOR')
  .action(async () => { await profileScoreEdit(); });
profileScoreCmd
  .command('init')
  .description('Create profiles/<active>/score.md with the placeholder header (idempotent)')
  .action(async () => { await profileScoreInit(); });
profileCmd.addCommand(profileScoreCmd);
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
