import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hunt } from '../commands/hunt/index.js';
import { tailor } from '../commands/tailor/index.js';
import { fill } from '../commands/fill/index.js';
import { reach } from '../commands/reach/index.js';

export function registerTools(server: McpServer): void {
  server.registerTool(
    'wolf_hunt',
    {
      description: 'Find and score job listings from configured providers',
      inputSchema: {
        profileId: z.string().optional(),
        role: z.string().optional(),
        location: z.string().optional(),
        maxResults: z.number().optional(),
      },
    },
    async (args) => {
      const result = await hunt(args);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.registerTool(
    'wolf_tailor',
    {
      description: 'Tailor resume and generate cover letter for a specific job',
      inputSchema: {
        jobId: z.string(),
        profileId: z.string().optional(),
        coverLetter: z.boolean().optional(),
      },
    },
    async (args) => {
      const result = await tailor(args);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.registerTool(
    'wolf_fill',
    {
      description: 'Auto-fill a job application form',
      inputSchema: {
        jobId: z.string(),
        profileId: z.string().optional(),
        dryRun: z.boolean().optional(),
      },
    },
    async (args) => {
      const result = await fill(args);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.registerTool(
    'wolf_reach',
    {
      description: 'Find HR contacts and draft outreach email for a job',
      inputSchema: {
        jobId: z.string(),
        profileId: z.string().optional(),
        send: z.boolean().optional(),
      },
    },
    async (args) => {
      const result = await reach(args);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
