/**
 * tailor/index.ts — AI-powered resume tailoring.
 *
 * Given a job ID, wolf reads the user's general-purpose resume template and their
 * full content pool, then asks Claude to select the most relevant experiences and
 * projects for the target JD, producing a tailored .tex.
 *
 * ## Prerequisites
 *
 * Before calling wolf_tailor, the user must have run wolf_templategen at least once
 * to generate the general resume under the profile's data directory. If the file is
 * missing, tailor throws with a clear message directing the user to run templategen first.
 *
 * ## Output location
 *
 *   data/<profileId>_<profileLabel>/<company>_<title>_<jobId>/
 *     resume.tex
 *     resume.pdf
 *     resume.png
 *     jd.txt
 *     snapshots/
 *       resume_<hash>.txt
 *       style_<hash>.jpg   (if style_ref.jpg exists)
 *       template_<hash>.tex
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { mdToPdf } from 'md-to-pdf';
import type { TailorOptions, TailorResult } from '../../types/index.js';
import { initDb, getJob, getCompany, updateJob } from '../../utils/db.js';
import { loadConfig } from '../../utils/config.js';
import { snapshotAsset, fileExists } from '../../utils/resume-snapshot.js';
import {
  generalResumeDir,
  jobOutputDir,
  jobSnapshotsDir,
  resumeTxtPath,
  styleRefPath,
} from '../../utils/fs-helpers.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildTailorPrompt(
  resumeTex: string,
  resumeTxt: string,
  jdText: string,
  tailorNotes: string | null,
): string {
  return `You are an expert resume writer. Tailor the user's resume to the job description below.

INSTRUCTIONS:
- You have two inputs: a LaTeX resume template (RESUME TEMPLATE) and a full content pool (CONTENT POOL).
- The RESUME TEMPLATE defines the visual structure and LaTeX macros — preserve it exactly.
- The CONTENT POOL contains ALL of the user's experiences, projects, skills, and achievements.
- SELECT the most relevant experiences, projects, and skills from the CONTENT POOL based on the JD.
- REWRITE selected bullet points to use JD keywords naturally and highlight the strongest match.
- You may omit less relevant items to keep the resume concise (1–2 pages).
- Do NOT add experiences or projects that are not in the CONTENT POOL.
- Return the complete tailored .tex file. No markdown code fences, no explanation — only raw LaTeX.
- After \\end{document}, append a single line in this exact format (no newlines inside):
  %WOLF_META{"matchScore":0.85,"changes":["Selected X over Y because JD emphasises Z","Rewrote bullet to highlight A","..."]}

${tailorNotes ? `ADDITIONAL INSTRUCTIONS FROM USER:\n${tailorNotes}\n` : ''}
JOB DESCRIPTION:
${jdText}

RESUME TEMPLATE (LaTeX structure to preserve):
${resumeTex}

CONTENT POOL (all available experiences — select and adapt the best fit):
${resumeTxt}`;
}

function parseWolfMeta(texOutput: string): { matchScore: number; changes: string[] } {
  const match = texOutput.match(/%WOLF_META(\{.*\})/);
  if (!match) return { matchScore: 0, changes: [] };
  try {
    const parsed = JSON.parse(match[1]) as { matchScore?: number; changes?: string[] };
    return {
      matchScore: typeof parsed.matchScore === 'number' ? parsed.matchScore : 0,
      changes: Array.isArray(parsed.changes) ? parsed.changes : [],
    };
  } catch {
    return { matchScore: 0, changes: [] };
  }
}

function validateTex(tex: string): void {
  if (!tex.includes('\\begin{document}') || !tex.includes('\\end{document}')) {
    throw new Error('Claude returned invalid LaTeX — missing \\begin{document} or \\end{document}.');
  }
}

async function compileTex(texPath: string): Promise<string> {
  const dir = path.dirname(texPath);
  const args = ['-interaction=nonstopmode', '-output-directory', dir, texPath];
  try {
    await execFileAsync('pdflatex', args);
    await execFileAsync('pdflatex', args);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`pdflatex compilation failed: ${msg}`);
  }
  return texPath.replace(/\.tex$/, '.pdf');
}

async function pdfToScreenshot(pdfPath: string): Promise<string> {
  const dir = path.dirname(pdfPath);
  const base = path.basename(pdfPath, '.pdf');
  const outputPrefix = path.join(dir, base);
  await execFileAsync('pdftoppm', ['-r', '150', '-png', '-singlefile', pdfPath, outputPrefix]);
  return `${outputPrefix}.png`;
}

function stripComments(txt: string): string {
  return txt
    .split('\n')
    .filter(line => !line.trimStart().startsWith('//'))
    .join('\n');
}

/**
 * Builds the Claude prompt for generating a tailored cover letter.
 */
function buildClPrompt(
  resumeTxt: string,
  jdText: string,
  profileInfo: { name: string; email: string; phone: string },
  clNotes: string | null,
): string {
  return `You are an expert cover letter writer. Write a tailored cover letter for the job description below.

INSTRUCTIONS:
- Write in a professional but genuine tone.
- Draw only from the RESUME CONTENT — do not invent experiences or skills.
- Highlight 2–3 specific experiences from the resume that are most relevant to the JD.
- Keep it to 3–4 paragraphs, under 400 words.
- Output in Markdown format — use the following structure exactly:
  - First line: applicant name (e.g. "# John Doe")
  - Second line: contact info (email | phone)
  - Blank line
  - Date (today's date)
  - Blank line
  - Body paragraphs
  - Closing and signature
- Do NOT add a subject line or "Dear Hiring Manager" unless you know the recipient's name.

APPLICANT:
Name: ${profileInfo.name}
Email: ${profileInfo.email}
Phone: ${profileInfo.phone}

${clNotes ? `ADDITIONAL INSTRUCTIONS FROM USER:\n${clNotes}\n` : ''}
JOB DESCRIPTION:
${jdText}

RESUME CONTENT:
${resumeTxt}`;
}

/**
 * Compiles a Markdown file to PDF via md-to-pdf.
 * Returns the output PDF path.
 */
async function compileMdToPdf(mdPath: string): Promise<string> {
  const pdfPath = mdPath.replace(/\.md$/, '.pdf');
  const content = await fs.readFile(mdPath, 'utf-8');
  const result = await mdToPdf({ content }, { dest: pdfPath });
  if (!result || !result.filename) {
    throw new Error(`md-to-pdf failed to compile: ${mdPath}`);
  }
  return pdfPath;
}

/**
 * Runs pdftoppm at 72 DPI (all pages) and returns the sorted list of PNG paths.
 * outputPrefix is e.g. "/some/dir/p" — pdftoppm writes "p-1.png", "p-2.png", etc.
 */
async function pdfPageImages(pdfPath: string, outputPrefix: string): Promise<string[]> {
  await execFileAsync('pdftoppm', ['-r', '72', '-png', pdfPath, outputPrefix]);
  const dir = path.dirname(outputPrefix);
  const base = path.basename(outputPrefix);
  const files = await fs.readdir(dir);
  return files
    .filter(f => f.startsWith(base) && f.endsWith('.png'))
    .sort()
    .map(f => path.join(dir, f));
}

/** Extracts a complete LaTeX document from Claude's response (handles code blocks or raw output). */
function extractLatex(text: string): string | null {
  const codeBlock = text.match(/```(?:latex|tex)?\s*\n([\s\S]*?)```/);
  const candidate = codeBlock ? codeBlock[1].trim() : text.match(/(\\documentclass[\s\S]*)/)?.[1]?.trim() ?? null;
  if (candidate && candidate.includes('\\begin{document}')) return candidate;
  return null;
}

function buildRefinementPrompt(currentTex: string, pageCount: number, maxPages: number): string {
  const overLimit = pageCount > maxPages;
  const issue = overLimit
    ? `PAGE OVERFLOW: the resume is ${pageCount} page(s) but must fit in ${maxPages}. Remove or shorten less critical content, reduce spacing.`
    : `ORPHAN WORD CHECK: scan every bullet point for lines where the final line contains only one word (e.g. a bullet wraps and the last line is just "latency." or "team."). Fix each occurrence by either shortening the bullet (remove a word or two) or expanding it (add a word or rephrase) so the last line has at least 2–3 words. Prefer expanding if the page has room; prefer shortening if space is tight.`;
  return `You are reviewing a tailored LaTeX resume. The PDF above has ${pageCount} page(s) (target: ≤${maxPages}).

Issue to fix:
${issue}

If the layout looks good (within page limit, no orphan lines): respond with the single word LGTM and nothing else — no explanation, no punctuation.

Otherwise return the complete corrected .tex (starting with \\documentclass). Strategies:
- Remove or shorten less relevant bullet points
- Reduce \\vspace, itemsep, parsep, or other spacing
- Tighten descriptions without removing JD keywords

Current .tex:
\`\`\`latex
${currentTex}
\`\`\`

Respond with ONLY "LGTM" or ONLY the complete corrected .tex — no other text.`;
}

function buildClShortenPrompt(currentMd: string, pageCount: number): string {
  return `The cover letter below compiled to ${pageCount} page(s) but must fit in exactly 1 page.

Shorten it — remove less essential sentences, tighten phrasing, or trim a paragraph — while keeping the core message, professional tone, and key personalisation.

Return only the shortened cover letter in markdown format, nothing else.

Current cover letter:
${currentMd}`;
}

/**
 * Compile → render pages at 72 DPI → ask Claude to review layout.
 * Loops up to MAX_ITER times. Returns final PDF path and screenshot path.
 */
async function refineResumeTex(
  initialTex: string,
  texPath: string,
  maxPages: number,
  client: Anthropic,
  jobDir: string,
): Promise<{ finalPdfPath: string; screenshotPath: string }> {
  const MAX_ITER = 5;
  let currentTex = initialTex;
  let currentPdfPath = '';
  let needsRecompile = false;
  const checkDir = path.join(jobDir, '_check');

  for (let i = 0; i < MAX_ITER; i++) {
    await fs.writeFile(texPath, currentTex, 'utf-8');
    currentPdfPath = await compileTex(texPath);
    needsRecompile = false;

    await fs.mkdir(checkDir, { recursive: true });
    const pageImages = await pdfPageImages(currentPdfPath, path.join(checkDir, 'p'));

    const imageBlocks = await Promise.all(
      pageImages.map(async (imgPath) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/png' as const,
          data: (await fs.readFile(imgPath)).toString('base64'),
        },
      })),
    );

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: buildRefinementPrompt(currentTex, pageImages.length, maxPages) }] }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    if (text.trimStart().startsWith('LGTM')) break;

    const newTex = extractLatex(text);
    if (!newTex) break;
    currentTex = newTex;
    needsRecompile = true;
  }

  if (needsRecompile) {
    await fs.writeFile(texPath, currentTex, 'utf-8');
    currentPdfPath = await compileTex(texPath);
  }

  const screenshotPath = await pdfToScreenshot(currentPdfPath);
  return { finalPdfPath: currentPdfPath, screenshotPath };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function tailor(options: TailorOptions): Promise<TailorResult> {
  const workspaceDir = process.cwd();
  await initDb(workspaceDir);

  // ── 1. Load job, company, and profile ──────────────────────────────────────
  const job = await getJob(options.jobId);
  if (!job) throw new Error(`Job not found: ${options.jobId}`);

  const company = await getCompany(job.companyId);
  const companyName = company?.name ?? 'unknown';

  const config = await loadConfig();
  const profileId = options.profileId ?? config.defaultProfileId;
  const profile = config.profiles.find(p => p.id === profileId);
  if (!profile) throw new Error(`Profile not found: ${profileId}`);

  // ── 2. Resolve paths ───────────────────────────────────────────────────────
  const txtPath = resumeTxtPath(workspaceDir, profile.id, profile.label);
  const genResumeDir = generalResumeDir(workspaceDir, profile.id, profile.label);
  const texPath = path.join(genResumeDir, 'resume.tex');

  if (!(await fileExists(txtPath))) {
    throw new Error(
      `resume.txt not found at ${txtPath}. ` +
      'Provide the resume content file for this profile first.',
    );
  }
  if (!(await fileExists(texPath))) {
    throw new Error(
      `resume.tex not found at ${texPath}. ` +
      'Run wolf_templategen first to generate the resume template.',
    );
  }

  // ── 3. Read inputs ─────────────────────────────────────────────────────────
  const [rawTxt, resumeTex] = await Promise.all([
    fs.readFile(txtPath, 'utf-8'),
    fs.readFile(texPath, 'utf-8'),
  ]);
  const resumeContent = stripComments(rawTxt);

  // ── 4. Prepare job output directory ───────────────────────────────────────
  const jobDir = jobOutputDir(workspaceDir, profile.id, profile.label, companyName, job.title, job.id);
  await fs.mkdir(jobDir, { recursive: true });

  // ── 5. Write jd.txt ───────────────────────────────────────────────────────
  await fs.writeFile(path.join(jobDir, 'jd.txt'), job.description, 'utf-8');

  // ── 6. Load tailor_notes.md if present ────────────────────────────────────
  const tailorNotesPath = path.join(jobDir, 'tailor_notes.md');
  let tailorNotes: string | null = null;
  try {
    tailorNotes = await fs.readFile(tailorNotesPath, 'utf-8');
  } catch {
    // not present — fine
  }

  // ── 7. Call Claude ─────────────────────────────────────────────────────────
  const client = new Anthropic({ apiKey: process.env.WOLF_ANTHROPIC_API_KEY });
  const prompt = buildTailorPrompt(resumeTex, resumeContent, job.description, tailorNotes);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  let texOutput = response.content[0].type === 'text' ? response.content[0].text : '';
  texOutput = texOutput.replace(/^```(?:latex|tex)?\n?/m, '').replace(/\n?```$/m, '').trim();

  validateTex(texOutput);
  const { matchScore, changes } = parseWolfMeta(texOutput);
  const cleanTex = texOutput.replace(/%WOLF_META\{.*\}\s*$/, '').trimEnd() + '\n';

  // ── 8. Refine resume: compile → check pages/orphans → revise with Claude ──
  const tailoredTexPath = path.join(jobDir, 'resume.tex');
  const maxPages = profile.maxResumePages ?? 1;
  const { finalPdfPath: tailoredPdfPath, screenshotPath } = await refineResumeTex(
    cleanTex, tailoredTexPath, maxPages, client, jobDir,
  );

  // ── 11. Cover letter (optional) ───────────────────────────────────────────
  let coverLetterMdPath: string | null = null;
  let coverLetterPdfPath: string | null = null;

  if (options.coverLetter) {
    // Read cl_notes.md if present
    const clNotesPath = path.join(jobDir, 'cl_notes.md');
    let clNotes: string | null = null;
    try {
      clNotes = await fs.readFile(clNotesPath, 'utf-8');
    } catch {
      // not present — fine
    }

    const clPrompt = buildClPrompt(
      resumeContent,
      job.description,
      { name: profile.name, email: profile.email, phone: profile.phone },
      clNotes,
    );

    const clResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: clPrompt }],
    });

    const clMd = clResponse.content[0].type === 'text' ? clResponse.content[0].text : '';
    coverLetterMdPath = path.join(jobDir, 'cover_letter.md');
    await fs.writeFile(coverLetterMdPath, clMd, 'utf-8');
    coverLetterPdfPath = await compileMdToPdf(coverLetterMdPath);

    // ── 11b. CL page check — shorten if > 1 page ────────────────────────────
    const clCheckDir = path.join(jobDir, '_check_cl');
    await fs.mkdir(clCheckDir, { recursive: true });
    const clPages = await pdfPageImages(coverLetterPdfPath, path.join(clCheckDir, 'p'));
    if (clPages.length > 1) {
      const shortenResponse = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: buildClShortenPrompt(clMd, clPages.length) }],
      });
      const shortenedMd = shortenResponse.content[0].type === 'text' ? shortenResponse.content[0].text : clMd;
      await fs.writeFile(coverLetterMdPath, shortenedMd, 'utf-8');
      coverLetterPdfPath = await compileMdToPdf(coverLetterMdPath);
    }
  }

  // ── 12. Snapshot inputs (must come after CL so all outputs are final) ──────
  const snapshotsDir = jobSnapshotsDir(jobDir);
  const styleRef = styleRefPath(workspaceDir, profile.id, profile.label);
  const hasStyleRef = await fileExists(styleRef);

  const [resumeSnapshot, texSnapshot] = await Promise.all([
    snapshotAsset(txtPath, 'txt', snapshotsDir),
    snapshotAsset(texPath, 'tex', snapshotsDir),
  ]);
  const styleSnapshot = hasStyleRef
    ? await snapshotAsset(styleRef, 'jpg', snapshotsDir)
    : null;

  // ── 14. Update job record ──────────────────────────────────────────────────
  await updateJob(job.id, {
    tailoredResumePath: tailoredTexPath,
    tailoredResumePdfPath: tailoredPdfPath,
    coverLetterPath: coverLetterMdPath,
    coverLetterPdfPath,
    screenshotPath,
    resumeSnapshot,
    styleSnapshot,
    texSnapshot,
    status: 'reviewed',
  });

  return {
    tailoredTexPath,
    tailoredPdfPath,
    coverLetterMdPath,
    coverLetterPdfPath,
    screenshotPath,
    changes,
    matchScore,
  };
}
