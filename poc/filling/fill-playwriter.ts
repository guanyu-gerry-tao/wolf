/**
 * POC: Playwriter form-filling pipeline
 *
 * Architecture:
 *   1. Start Playwriter CDP relay server (local WebSocket bridge)
 *   2. Playwright connects to user's real Chrome via connectOverCDP
 *      → real cookies, real fingerprint, no navigator.webdriver flag
 *   3. Navigate to target URL
 *   4. One page.accessibility.snapshot() → accessibility tree
 *   5. One Claude API call → field mapping JSON (AI reads only)
 *   6. wolf executes fill directly via Playwright API — no MCP round-trips, no AI
 *      → includes file upload via setInputFiles()
 *
 * Run:
 *   npx tsx poc/filling/fill-playwriter.ts <url>
 *
 * Prerequisites:
 *   - Chrome with Playwriter extension installed (https://playwriter.dev)
 *   - Click the extension icon on the target tab (icon turns green)
 *   - WOLF_ANTHROPIC_API_KEY set in environment
 */

import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env'), override: true });

import { chromium } from 'playwright-core';
import { getCdpUrl } from 'playwriter';
import Anthropic from '@anthropic-ai/sdk';
import { createInterface } from 'readline';
import type { Page } from 'playwright-core';

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
  resumePath: new URL('./Resume.pdf', import.meta.url).pathname,
  workAuthorized: 'Yes',
  requireSponsorship: 'No',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Action = 'type' | 'click' | 'upload' | 'select' | 'skip';

interface FieldMapping {
  label: string;   // accessible name from the tree — used by getByLabel / getByRole
  role: string;    // e.g. "textbox", "combobox", "button", "checkbox"
  action: Action;
  value: string | null;
}

// ---------------------------------------------------------------------------
// Step 2 — analyze accessibility tree with Claude, return mapping
// ---------------------------------------------------------------------------
async function analyzeForm(treeText: string): Promise<FieldMapping[]> {
  const apiKey = process.env.WOLF_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('WOLF_ANTHROPIC_API_KEY is not set');

  const anthropic = new Anthropic({ apiKey });

  const prompt = `You are analyzing a job application form accessibility tree.
Map each fillable field to the user profile value below.

ACCESSIBILITY TREE:
${treeText}

USER PROFILE:
${JSON.stringify(TEST_PROFILE, null, 2)}

Rules:
- "label" must be the EXACT accessible name from the tree
- "role" must be the EXACT role from the tree (textbox, combobox, button, checkbox, etc.)
- "action":
    "type"   → text/email/phone inputs (role: textbox)
    "select" → dropdowns (role: combobox)
    "upload" → file inputs (role: textbox with label containing resume/cv/upload)
    "click"  → submit buttons (role: button)
    "skip"   → no matching profile data
- "value": the profile value to use, or null for click/skip
- Only include fields you can confidently map
- Do NOT include decorative elements or hidden fields
- Do NOT include submit buttons — user submits manually

Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "label": "<name>", "role": "<role>", "action": "type|select|upload|click|skip", "value": "<value or null>" }
]`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content[0] as { text: string }).text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(raw) as FieldMapping[];
  } catch {
    console.error('[wolf poc] Claude returned unexpected output:\n', raw);
    throw new Error('Failed to parse field mapping from Claude');
  }
}

// ---------------------------------------------------------------------------
// Step 3 — program executes mapping via Playwright — no AI from here
// ---------------------------------------------------------------------------
async function executeFill(page: Page, mapping: FieldMapping[]): Promise<void> {
  for (const field of mapping) {
    if (field.action === 'skip') continue;

    try {
      if (field.action === 'type' && field.value) {
        await page.locator(`[aria-label="${field.label}"]`).fill(field.value);
        console.log(`  ✓ type     "${field.label}" → "${field.value}"`);

      } else if (field.action === 'select' && field.value) {
        await page.locator(`[aria-label="${field.label}"]`).selectOption(field.value);
        console.log(`  ✓ select   "${field.label}" → "${field.value}"`);

      } else if (field.action === 'upload' && field.value) {
        await page.locator(`[aria-label="${field.label}"]`).setInputFiles(field.value);
        console.log(`  ✓ upload   "${field.label}" → "${field.value}"`);

      } else if (field.action === 'click') {
        // POC: never auto-click submit — user submits manually
        console.log(`  ⏭ skip     "${field.label}" (submit blocked in POC)`);
      }
    } catch (err) {
      // Non-fatal: log and continue with remaining fields
      console.warn(`  ⚠ failed   "${field.label}": ${(err as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>(resolve => rl.question(question, resolve));
  rl.close();
  return answer.trim().toLowerCase() === 'y';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const targetUrl = process.argv[2];
  if (!targetUrl) {
    console.error('Usage: npx tsx poc/filling/fill-playwriter.ts <url>');
    process.exit(1);
  }

  // --- start relay and wait for extension to stabilize ---
  const { startPlayWriterCDPRelayServer } = await import('playwriter');
  console.log('[wolf poc] Starting Playwriter relay...');
  const server = await startPlayWriterCDPRelayServer();
  await new Promise(r => setTimeout(r, 2000)); // wait for extension to fully connect

  console.log('[wolf poc] Connecting to real Chrome via CDP...');
  const browser = await chromium.connectOverCDP(getCdpUrl());
  console.log('[wolf poc] Connected.\n');

  try {
    // Use the first available context (user's real browser session)
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? await context.newPage();

    // --- navigate ---
    console.log(`[wolf poc] Navigating to ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    // --- extract form fields via CDP (works with connectOverCDP) ---
    console.log('[wolf poc] Taking accessibility snapshot...');
    const treeText = await page.evaluate(() => {
      const lines: string[] = [];
      document.querySelectorAll('input, select, textarea').forEach(el => {
        const id = el.getAttribute('id') ?? '';
        const type = (el as HTMLInputElement).type ?? el.tagName.toLowerCase();
        const ariaLabel = el.getAttribute('aria-label') ?? '';
        const placeholder = el.getAttribute('placeholder') ?? '';
        const labelEl = id ? document.querySelector(`label[for="${id}"]`) : el.closest('label');
        const label = labelEl?.textContent?.trim().replace(/\s+/g, ' ') ?? '';
        const name = ariaLabel || label.replace(/\s*\*\s*/g, '').trim() || placeholder;
        if (name) lines.push(`${type} | aria-label="${name}"`);
      });
      return lines.join('\n');
    });
    console.log(`[wolf poc] Snapshot: ${treeText.length} chars\n`);

    // --- Claude analyzes once ---
    console.log('[wolf poc] Sending to Claude (one inference call)...');
    const mapping = await analyzeForm(treeText);

    // --- dry-run: print mapping ---
    console.log('\n[wolf poc] Proposed field mapping:');
    console.log('  ACTION   ROLE       FIELD                          VALUE');
    console.log('  ──────────────────────────────────────────────────────────');
    for (const f of mapping) {
      const val = f.value ?? '—';
      console.log(
        `  ${f.action.padEnd(8)} ${f.role.padEnd(10)} ${f.label.padEnd(30)} ${val}`
      );
    }

    const ok = await confirm('\n[wolf poc] Execute fill? (y/N) ');
    if (!ok) {
      console.log('[wolf poc] Aborted.');
      return;
    }

    // --- program fills — AI not involved from this point ---
    console.log('\n[wolf poc] Filling...');
    await executeFill(page, mapping);

    // --- screenshot for audit ---
    console.log('\n[wolf poc] Taking audit screenshot...');
    const screenshotPath = `poc/filling/screenshot-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[wolf poc] Screenshot saved → ${screenshotPath}`);

    console.log('\n[wolf poc] Done. Review the browser before closing.');

  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(err => {
  console.error('[wolf poc] Fatal:', (err as Error).message);
  process.exit(1);
});
