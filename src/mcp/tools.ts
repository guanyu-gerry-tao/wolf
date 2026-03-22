import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

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
    'wolf_score',
    {
      description: `Process unscored jobs in the database: extract structured fields from JD text,
apply dealbreaker filters, and submit remaining jobs to Claude Batch API for async scoring.
Use this after wolf_hunt has ingested jobs, or on a schedule to keep scores up to date.
Returns a batch ID immediately — scoring completes in the background.`,
      inputSchema: {
        profileId: z.string().optional().describe('Profile to use for dealbreakers and scoring preferences; defaults to defaultProfileId in wolf.toml'),
        jobIds: z.array(z.string()).optional().describe('Score only specific job IDs; defaults to all unscored jobs'),
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
    // TODO(M2): replace with async (args) => { const result = await tailor(args); ... }
    (args) => {
      if (!args.jobId) {
        return { content: [{ type: 'text', text: JSON.stringify(missingParam('jobId', 'A jobId is required. Run wolf_hunt first to get a list of jobs.')) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(notImplemented('wolf_tailor')) }] };
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
        const config = await loadConfig();
        const profile = config.profiles?.[0];
        const hasProfile = !!profile?.name && !!profile?.email;
        const hasResume = !!profile?.resumePath;

        const result = {
          profile: hasProfile ? 'ok' : 'missing',
          resume: hasResume ? 'ok' : 'missing',
          integrations: {
            anthropic: !!process.env['WOLF_ANTHROPIC_API_KEY'],
            apify: !!process.env['WOLF_APIFY_API_TOKEN'],
            gmail: !!process.env['WOLF_GMAIL_CLIENT_ID'],
          },
          next_step: !hasProfile
            ? 'Run `wolf init` in your workspace to set up your profile.'
            : !hasResume
              ? 'Add your resume path to wolf.toml, or re-run `wolf init`.'
              : !process.env['WOLF_ANTHROPIC_API_KEY']
                ? 'Run `wolf env set` to configure your API keys.'
                : 'Wolf is ready. Try `wolf_hunt` to find jobs.',
        };

        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              profile: 'missing',
              resume: 'missing',
              integrations: { anthropic: false, apify: false, gmail: false },
              next_step: 'No wolf.toml found. Run `wolf init` in your workspace directory first.',
            }),
          }],
        };
      }
    }
  );
}
