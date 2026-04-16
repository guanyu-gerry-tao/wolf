import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { add } from '../commands/add/index.js';
import { tailor } from '../commands/tailor/index.js';

function notImplemented(tool: string): object {
  return { error: 'not_implemented', tool, message: `${tool} is not yet implemented.` };
}

function missingParam(param: string, prompt: string): object {
  return { error: 'missing_param', param, prompt };
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    'wolf_hunt',
    {
      description: `Search, find, and score job listings from configured job platforms (LinkedIn, Handshake, etc.).
Use this when the user wants to find jobs, search openings, or says anything like
"help me find a job", "look for internships", "search SWE roles".
Before calling, if role or location are not provided, ask the user:
1. What role are they looking for? (e.g. "SWE intern", "backend engineer")
2. What location or remote preference?
Then call with those parameters.`,
      inputSchema: {
        role: z.string().optional().describe('Job role or title to search for, e.g. "SWE intern"'),
        location: z.string().optional().describe('Location or "remote"'),
        maxResults: z.number().optional().describe('Maximum number of results to return'),
        profileId: z.string().optional().describe('Profile to use; defaults to defaultProfileId in wolf.toml'),
      },
    },
    // TODO(M2): replace with async (args) => { const result = await hunt(args); ... }
    (args) => {
      if (!args.role) {
        return { content: [{ type: 'text', text: JSON.stringify(missingParam('role', 'What role are you looking for? (e.g. "SWE intern", "backend engineer")')) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(notImplemented('wolf_hunt')) }] };
    }
  );

  server.registerTool(
    'wolf_add',
    {
      description: `Add a single job to wolf's database from structured data provided by the AI caller.
Use this when the user shares a job they found — screenshot, pasted JD text, or URL content.
YOU (the AI) must extract title, company, and jdText from the user's input before calling this tool.
wolf_add only stores — it does not parse raw text or screenshots.
After calling wolf_add, chain to wolf_score with single: true to immediately score the job,
then present the result to the user and offer to run wolf_tailor.`,
      inputSchema: {
        title: z.string().describe('Job title extracted from the user\'s input'),
        company: z.string().describe('Company name extracted from the user\'s input'),
        jdText: z.string().describe('Full job description text extracted from the user\'s input'),
        url: z.string().optional().describe('Original job posting URL, if available'),
        profileId: z.string().optional().describe('Profile to use; defaults to defaultProfileId in wolf.toml'),
      },
    },
    async (args) => {
      if (!args.title || !args.company || !args.jdText) {
        return { content: [{ type: 'text', text: JSON.stringify(missingParam('title/company/jdText', 'Extract title, company, and jdText from the user\'s input before calling wolf_add.')) }] };
      }
      const result = await add({
        title: args.title as string,
        company: args.company as string,
        jdText: args.jdText as string,
        url: args.url as string | undefined,
        profileId: args.profileId as string | undefined,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.registerTool(
    'wolf_score',
    {
      description: `Process unscored jobs in the database: extract structured fields from JD text,
apply dealbreaker filters, and submit remaining jobs to Claude Batch API for async scoring.
Use this after wolf_hunt has ingested jobs, or on a schedule to keep scores up to date.
Returns a batch ID immediately — scoring completes in the background.`,
      inputSchema: {
        profileId: z.string().optional().describe('Profile to use for dealbreakers and scoring preferences; defaults to defaultProfileId in wolf.toml'),
        jobIds: z.array(z.string()).optional().describe('Score only specific job IDs; defaults to all unscored jobs'),
        single: z.boolean().optional().describe('If true, skip Batch API and score synchronously via Haiku — use this after wolf_add for immediate results'),
        poll: z.boolean().optional().describe('If true, poll pending batches for results without submitting new jobs'),
      },
    },
    // TODO(M2): replace with async (args) => { const result = await score(args); ... }
    (_args) => {
      return { content: [{ type: 'text', text: JSON.stringify(notImplemented('wolf_score')) }] };
    }
  );

  server.registerTool(
    'wolf_tailor',
    {
      description: `Tailor the user's resume and optionally generate a cover letter for a specific job.
Use this when the user wants to customize their application for a role, or says
"tailor my resume", "write a cover letter", "help me apply to this job".
Requires a jobId — if not provided, suggest running wolf_hunt first to get one.
Ask user if they want a cover letter generated (coverLetter: true/false).`,
      inputSchema: {
        jobId: z.string().describe('Job ID from wolf_hunt results'),
        coverLetter: z.boolean().optional().describe('Whether to generate a cover letter'),
        profileId: z.string().optional().describe('Profile to use; defaults to defaultProfileId in wolf.toml'),
      },
    },
    async (args) => {
      if (!args.jobId) {
        return { content: [{ type: 'text', text: JSON.stringify(missingParam('jobId', 'A jobId is required. Run wolf_add or wolf_hunt first.')) }] };
      }
      const result = await tailor({
        jobId: args.jobId as string,
        profileId: args.profileId as string | undefined,
        coverLetter: args.coverLetter as boolean | undefined,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.registerTool(
    'wolf_fill',
    {
      description: `Auto-fill a job application form for a specific job using the user's profile.
Use this when the user says "fill out the application", "submit my application",
"auto-fill the form", or "apply to this job".
Requires a jobId. If not provided, suggest running wolf_hunt first.
Supports dryRun: true for previewing what would be filled without submitting.`,
      inputSchema: {
        jobId: z.string().describe('Job ID from wolf_hunt results'),
        dryRun: z.boolean().optional().describe('If true, preview only — do not actually submit'),
        profileId: z.string().optional().describe('Profile to use; defaults to defaultProfileId in wolf.toml'),
      },
    },
    // TODO(M2): replace with async (args) => { const result = await fill(args); ... }
    (args) => {
      if (!args.jobId) {
        return { content: [{ type: 'text', text: JSON.stringify(missingParam('jobId', 'A jobId is required. Run wolf_hunt first to get a list of jobs.')) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(notImplemented('wolf_fill')) }] };
    }
  );

  server.registerTool(
    'wolf_reach',
    {
      description: `Find HR or recruiter contacts for a job and draft an outreach email.
Optionally send the email if user confirms (send: true).
Use this when the user says "reach out to the recruiter", "contact HR",
"send a cold email", "do referral outreach".
Requires a jobId. If send is not specified, default to false and show draft first.`,
      inputSchema: {
        jobId: z.string().describe('Job ID from wolf_hunt results'),
        send: z.boolean().optional().describe('If true, send the email; if false or omitted, show draft only'),
        profileId: z.string().optional().describe('Profile to use; defaults to defaultProfileId in wolf.toml'),
      },
    },
    // TODO(M2): replace with async (args) => { const result = await reach(args); ... }
    (args) => {
      if (!args.jobId) {
        return { content: [{ type: 'text', text: JSON.stringify(missingParam('jobId', 'A jobId is required. Run wolf_hunt first to get a list of jobs.')) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(notImplemented('wolf_reach')) }] };
    }
  );

  server.registerTool(
    'wolf_status',
    {
      description: `Check the current setup status of wolf: whether a user profile exists,
resume is loaded, and API integrations are configured.
Call this first if the user seems to be a new user, or says
"get started", "set up wolf", "is wolf ready", or "check my setup".
Returns what's missing and what the next step should be.`,
      inputSchema: {},
    },
    async () => {
      try {
        const { loadConfig } = await import('../utils/config.js');
        const { createAppContext } = await import('../cli/appContext.js');
        // loadConfig validates wolf.toml exists; createAppContext opens SQLite + loads profile.
        await loadConfig();
        const ctx = createAppContext();
        const profile = await ctx.profileRepository.getDefault();
        const hasProfile = !!profile?.name && !!profile?.email;

        const result = {
          profile: hasProfile ? 'ok' : 'missing',
          integrations: {
            anthropic: !!process.env['WOLF_ANTHROPIC_API_KEY'],
            apify: !!process.env['WOLF_APIFY_API_TOKEN'],
          },
          next_step: !hasProfile
            ? 'Run `wolf init` in your workspace to set up your profile.'
            : !process.env['WOLF_ANTHROPIC_API_KEY']
              ? 'Set WOLF_ANTHROPIC_API_KEY in your shell to enable AI features.'
              : 'Wolf is ready. Try `wolf_add` or `wolf_hunt` to get started.',
        };

        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              profile: 'missing',
              integrations: { anthropic: false, apify: false },
              next_step: 'No wolf.toml found. Run `wolf init` in your workspace directory first.',
            }),
          }],
        };
      }
    }
  );
}
