import fs from 'node:fs/promises';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { tailor } from '../commands/tailor/index.js';
import { templategen } from '../commands/templategen/index.js';
import { setupWorkspace } from '../commands/init/index.js';
import { resumeTxtPath, profileDir } from '../utils/fs-helpers.js';

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
    // TODO(M2): replace with async (args) => { const result = await add(args); ... }
    (args) => {
      if (!args.title || !args.company || !args.jdText) {
        return { content: [{ type: 'text', text: JSON.stringify(missingParam('title/company/jdText', 'Extract title, company, and jdText from the user\'s input before calling wolf_add.')) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(notImplemented('wolf_add')) }] };
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
Ask user if they want a cover letter generated (coverLetter: true/false).

After receiving the result, present it to the user as follows:
1. Show the resume screenshot (returned as an image) so the user can preview the layout.
2. Show the match score and list the changes Claude made, e.g. "Match score: 0.82 — Changes: ..."
3. Show the output file paths in code blocks so the user can copy them for upload:
   \`\`\`
   Resume PDF:       <tailoredPdfPath>
   Cover letter PDF: <coverLetterPdfPath>   (only if generated)
   \`\`\``,
      inputSchema: {
        jobId: z.string().describe('Job ID from wolf_hunt results'),
        coverLetter: z.boolean().optional().describe('Whether to generate a cover letter'),
        profileId: z.string().optional().describe('Profile to use; defaults to defaultProfileId in wolf.toml'),
      },
    },
    async (args, _extra) => {
      if (!args.jobId) {
        return { content: [{ type: 'text', text: JSON.stringify(missingParam('jobId', 'A jobId is required. Run wolf_hunt first to get a list of jobs.')) }] };
      }
      try {
        const result = await tailor(args);
        const textBlock = { type: 'text' as const, text: JSON.stringify(result) };
        if (!result.screenshotPath) {
          return { content: [textBlock] };
        }
        try {
          const imgBuffer = await fs.readFile(result.screenshotPath);
          return {
            content: [
              textBlock,
              { type: 'image' as const, data: imgBuffer.toString('base64'), mimeType: 'image/png' as const },
            ],
          };
        } catch {
          return { content: [textBlock] };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'tailor_failed', message }) }] };
      }
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
    'wolf_templategen',
    {
      description: `Generate a general-purpose resume or cover letter LaTeX template.
Use this when the user wants to create or regenerate their resume template, or says
"generate my resume", "create a template", "my resume looks wrong, redo it".
Requires resume_pool.md to exist in data/resume/. Optionally uses style_ref.jpg for visual style.
If the user is unhappy with the result, call again with a prompt describing the changes.
Supports type: 'resume' (default) or 'cl' for cover letter templates.`,
      inputSchema: {
        type: z.enum(['resume', 'cl']).optional().describe('Template type: resume or cover letter (default: resume)'),
        prompt: z.string().optional().describe('Additional instructions for Claude, e.g. "make the header more minimal"'),
        profileId: z.string().optional().describe('Profile to use; defaults to defaultProfileId in wolf.toml'),
      },
    },
    async (args) => {
      try {
        const result = await templategen({ type: args.type ?? 'resume', prompt: args.prompt, profileId: args.profileId });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'templategen_failed', message }) }] };
      }
    }
  );

  server.registerTool(
    'wolf_setup',
    {
      description: `Set up a wolf workspace by writing wolf.toml and creating the data directory.

IMPORTANT — say this to the user BEFORE collecting any information:
"Wolf needs API keys (WOLF_ANTHROPIC_API_KEY etc.) to run AI features.
For security, I won't handle API keys — please run \`wolf env set\` in your terminal after setup."

Then collect the following through conversation (ask one topic at a time, allow corrections):
1. Full name, email, phone number
2. Work authorization / immigration status (e.g. "F-1 OPT need sponsorship", "US citizen")
3. Target roles (e.g. "Software Engineer, Backend Engineer")
4. Target locations (e.g. "NYC, Remote")
5. Key skills (e.g. "Python, TypeScript, React")

Once you have all fields confirmed by the user, call this tool once with the complete data.`,
      inputSchema: {
        name: z.string().describe('Full name'),
        email: z.string().describe('Email address'),
        phone: z.string().describe('Phone number'),
        immigrationStatus: z.string().optional().describe('Work auth / immigration status in plain English'),
        targetRoles: z.array(z.string()).optional().describe('Target job roles'),
        targetLocations: z.array(z.string()).optional().describe('Target locations or "Remote"'),
        skills: z.array(z.string()).optional().describe('Key skills'),
        linkedinUrl: z.string().optional().describe('LinkedIn profile URL'),
        githubUrl: z.string().optional().describe('GitHub profile URL'),
        resumeText: z.string().optional().describe('Resume content collected from user: summary, education, experience, projects, skills. Format with # SECTION headers.'),
      },
    },
    async (args, _extra) => {
      try {
        const { resumePoolPath: txtPath } = await setupWorkspace(process.cwd(), args);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: 'wolf workspace configured.',
              resumePoolPath: txtPath,
              next_steps: [
                'Run `wolf env set` in your terminal to configure API keys (WOLF_ANTHROPIC_API_KEY etc.)',
                args.resumeText ? 'Run wolf_templategen to generate your resume template.' : `Edit resume content at: ${txtPath} — then run wolf_templategen.`,
              ],
            }),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'setup_failed', message }) }] };
      }
    }
  );

  server.registerTool(
    'wolf_update_resume',
    {
      description: `Update the user's resume content pool (resume_pool.md) for a profile.
Use this when the user wants to add or update their resume content, or says
"update my resume", "add a new job to my resume", "my resume is outdated".

Before calling, collect the full updated resume content from the user.
Prompt them to provide: summary, education, experience, projects, and skills.
You may update only specific sections — tell the user which sections you're updating.

After calling, offer to run wolf_templategen to regenerate the resume template.`,
      inputSchema: {
        resumeText: z.string().describe('Full resume content. Use # SECTION headers (# SUMMARY, # EDUCATION, # EXPERIENCE, # PROJECTS, # SKILLS). Lines starting with // are treated as comments and ignored.'),
        profileId: z.string().optional().describe('Profile to update; defaults to defaultProfileId in wolf.toml'),
      },
    },
    async (args) => {
      try {
        const { loadConfig } = await import('../utils/config.js');
        const config = await loadConfig();
        const profileId = args.profileId ?? config.defaultProfileId;
        const profile = config.profiles.find(p => p.id === profileId);
        if (!profile) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'profile_not_found', profileId }) }] };
        }
        const profDir = profileDir(process.cwd(), profile.id, profile.label);
        await fs.mkdir(profDir, { recursive: true });
        const txtPath = resumeTxtPath(process.cwd(), profile.id, profile.label);
        await fs.writeFile(txtPath, args.resumeText, 'utf-8');
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            success: true,
            message: `resume_pool.md updated at ${txtPath}`,
            next_step: 'Run wolf_templategen to regenerate your resume template.',
          }) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'update_resume_failed', message }) }] };
      }
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
        const txtPath = profile ? resumeTxtPath(process.cwd(), profile.id, profile.label) : null;
        const hasResume = txtPath ? await fs.access(txtPath).then(() => true).catch(() => false) : false;

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
              ? 'Add your resume content to resume_pool.md, or re-run `wolf init`.'
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
