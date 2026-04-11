/**
 * POC: Browser MCP form-filling pipeline
 *
 * Architecture:
 *   1. Connect to Browser MCP server (runs in user's real Chrome — no webdriver flag)
 *   2. Navigate to the target URL
 *   3. One snapshot() call → accessibility tree (cheap, text-only)
 *   4. One Claude API call → field mapping JSON  (AI only reads, never executes)
 *   5. wolf program loops through mapping, calls browser_type/click directly (no AI in the loop)
 *
 * Run:
 *   npx tsx poc/fill-browsermcp.ts <url>
 *
 * Prerequisites:
 *   - Chrome with Browser MCP extension installed (https://browsermcp.io)
 *   - Browser MCP server running: npx @browsermcp/mcp@latest
 *   - WOLF_ANTHROPIC_API_KEY set in environment
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Anthropic from '@anthropic-ai/sdk';
import { createInterface } from 'readline';

// ---------------------------------------------------------------------------
// Hardcoded test profile — replace with wolf config in production
// ---------------------------------------------------------------------------
const TEST_PROFILE = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '+1 555-0100',
  location: 'San Francisco, CA',
  linkedIn: 'https://linkedin.com/in/johndoe',
  github: 'https://github.com/johndoe',
  resumePath: '/Users/johndoe/resume.pdf',
  workAuthorized: 'Yes',
  requireSponsorship: 'No',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Action = 'type' | 'click' | 'upload' | 'skip';

interface FieldMapping {
  element: string;  // exact accessible name from the snapshot
  action: Action;
  value: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extractText(result: unknown): string {
  const content = (result as { content: Array<{ text: string }> }).content;
  return content[0]?.text ?? '';
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>(resolve => rl.question(question, resolve));
  rl.close();
  return answer.trim().toLowerCase() === 'y';
}

// ---------------------------------------------------------------------------
// Step 3 — analyze snapshot with Claude, return structured mapping
// ---------------------------------------------------------------------------
async function analyzeForm(snapshotText: string): Promise<FieldMapping[]> {
  const apiKey = process.env.WOLF_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('WOLF_ANTHROPIC_API_KEY is not set');

  const anthropic = new Anthropic({ apiKey });

  const prompt = `You are analyzing a job application form.
Given the accessibility tree and the user profile below, return a JSON array that maps each fillable form field to the correct profile value.

ACCESSIBILITY TREE:
${snapshotText}

USER PROFILE:
${JSON.stringify(TEST_PROFILE, null, 2)}

Rules:
- "element" must be the EXACT accessible name as it appears in the tree
- "action" is one of: "type" (text input), "upload" (file input), "click" (button/submit), "skip" (no match)
- "value" is the profile value to use, or null for click/skip
- Only include fields you can confidently map — omit uncertain ones
- Do NOT include hidden fields or decorative elements

Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "element": "<accessible name>", "action": "type|upload|click|skip", "value": "<value or null>" }
]`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content[0] as { text: string }).text.trim();

  try {
    return JSON.parse(raw) as FieldMapping[];
  } catch {
    console.error('[wolf poc] Claude returned unexpected output:\n', raw);
    throw new Error('Failed to parse field mapping from Claude');
  }
}

// ---------------------------------------------------------------------------
// Step 4 — program executes mapping, no AI involved
// ---------------------------------------------------------------------------
async function executeFill(browser: Client, mapping: FieldMapping[]): Promise<void> {
  for (const field of mapping) {
    if (field.action === 'skip') continue;

    if (field.action === 'type' && field.value) {
      await browser.callTool({
        name: 'browser_type',
        arguments: { element: field.element, text: field.value },
      });
      console.log(`  ✓ type     "${field.element}" → "${field.value}"`);

    } else if (field.action === 'click') {
      await browser.callTool({
        name: 'browser_click',
        arguments: { element: field.element },
      });
      console.log(`  ✓ click    "${field.element}"`);

    } else if (field.action === 'upload') {
      // Browser MCP does not expose a file-upload tool yet.
      // In production this would use Playwright's setInputFiles() as fallback.
      console.log(`  ⚠ upload   "${field.element}" → "${field.value}" (manual action needed)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const targetUrl = process.argv[2];
  if (!targetUrl) {
    console.error('Usage: npx tsx poc/fill-browsermcp.ts <url>');
    process.exit(1);
  }

  // --- connect ---
  console.log('[wolf poc] Connecting to Browser MCP...');
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['@browsermcp/mcp@latest'],
  });
  const browser = new Client({ name: 'wolf-poc', version: '0.1.0' });
  await browser.connect(transport);
  console.log('[wolf poc] Connected.\n');

  try {
    // --- navigate ---
    console.log(`[wolf poc] Navigating to ${targetUrl}`);
    await browser.callTool({ name: 'browser_navigate', arguments: { url: targetUrl } });
    await browser.callTool({ name: 'browser_wait', arguments: { time: 2000 } });

    // --- snapshot (one call, cheap) ---
    console.log('[wolf poc] Taking accessibility snapshot...');
    const snapshotResult = await browser.callTool({ name: 'browser_snapshot', arguments: {} });
    const snapshotText = extractText(snapshotResult);
    console.log(`[wolf poc] Snapshot: ${snapshotText.length} chars\n`);

    // --- Claude analyzes once, returns mapping ---
    console.log('[wolf poc] Sending to Claude (one inference call)...');
    const mapping = await analyzeForm(snapshotText);

    // --- dry-run: print mapping ---
    console.log('\n[wolf poc] Proposed field mapping:');
    console.log('  ACTION   FIELD                          VALUE');
    console.log('  ─────────────────────────────────────────────────────');
    for (const f of mapping) {
      const val = f.value ?? '—';
      console.log(`  ${f.action.padEnd(8)} ${f.element.padEnd(30)} ${val}`);
    }

    const ok = await confirm('\n[wolf poc] Execute fill? (y/N) ');
    if (!ok) {
      console.log('[wolf poc] Aborted.');
      return;
    }

    // --- program executes — AI not involved from this point ---
    console.log('\n[wolf poc] Filling...');
    await executeFill(browser, mapping);

    // --- screenshot for audit ---
    console.log('\n[wolf poc] Taking audit screenshot...');
    const shot = await browser.callTool({ name: 'browser_screenshot', arguments: {} });
    console.log('[wolf poc] Screenshot captured.');
    void shot; // in production: save to data/screenshots/

    console.log('\n[wolf poc] Done. Review the browser before closing.');

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[wolf poc] Fatal:', (err as Error).message);
  process.exit(1);
});
