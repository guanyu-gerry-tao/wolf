#!/usr/bin/env node
import { Command } from 'commander';
import { hunt } from '../commands/hunt/index.js';
import { tailor } from '../commands/tailor/index.js';
import { fill } from '../commands/fill/index.js';
import { reach } from '../commands/reach/index.js';
import { status } from '../commands/status/index.js';
import { init } from '../commands/init/index.js';
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
  .command('tailor')
  .description('Tailor resume to a job description')
  .requiredOption('-j, --job <id>', 'Job ID')
  .option('-p, --profile <id>', 'Profile to use')
  .option('--no-cover-letter', 'Skip cover letter generation')
  .option('--diff', 'Show before/after comparison')
  .action(async (opts) => {
    const result = await tailor({
      jobId: opts.job,
      profileId: opts.profile,
      coverLetter: opts.coverLetter,
      diff: opts.diff,
    });
    console.log(JSON.stringify(result, null, 2));
  });

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
  .description('List tracked jobs with status and score')
  .option('-s, --status <status>', 'Filter by status')
  .option('--min-score <n>', 'Filter by minimum score', parseFloat)
  .option('--since <date>', 'Filter by date (ISO 8601)')
  .action(async (opts) => {
    const result = await status({
      status: opts.status,
      minScore: opts.minScore,
      since: opts.since,
    });
    console.log(JSON.stringify(result, null, 2));
  });

const mcp = new Command('mcp').description('MCP server commands');
mcp
  .command('serve')
  .description('Start the MCP server')
  .action(async () => {
    await startMcpServer();
  });

program.addCommand(mcp);

program.parse();
