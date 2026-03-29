/**
 * tailor/index.ts — AI-powered resume tailoring.
 *
 * Given a job ID, wolf reads the user's master resume and the JD, then asks
 * Claude to generate a tailored resume as a complete .tex file.
 *
 * ## Two input paths
 *
 * - .tex source: Claude modifies bullet points while preserving the user's
 *   own LaTeX template and formatting.
 * - .pdf source: wolf converts the first page to a high-res image via pdftoppm,
 *   then passes the image to Claude Vision. Claude sees the visual layout and
 *   generates a new .tex that reflects the original style (wolf's functional
 *   preamble is prepended; Claude authors the visual layout and body).
 *
 * ## Master resume snapshots
 *
 * Before calling Claude, wolf hashes the resume file and saves a snapshot to
 * data/resume/snapshots/master_<hash>.<ext>. The snapshot filename is stored
 * on the job record so every tailor run is fully traceable.
 *
 * ## Output
 *
 * - data/tailored/<jobId>.tex  — tailored .tex
 * - data/tailored/<jobId>.pdf  — compiled PDF (via pdflatex)
 * - data/tailored/<jobId>.png  — first-page screenshot (via pdftoppm)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import Anthropic from '@anthropic-ai/sdk';
import type { TailorOptions, TailorResult } from '../../types/index.js';
import { initDb, getJob, updateJob } from '../../utils/db.js';
import { loadConfig } from '../../utils/config.js';
import { snapshotResume } from '../../utils/resume-snapshot.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Reads preamble.tex from the same directory as this file.
 * Used for PDF-source resumes only — prepended to Claude's generated body.
 */
async function readPreamble(): Promise<string> {
  const preamblePath = new URL('./preamble.tex', import.meta.url);
  return fs.readFile(preamblePath, 'utf-8');
}

/**
 * Converts the first page of a PDF to a high-res PNG via pdftoppm.
 * Returns the PNG as a base64 string.
 *
 * @param pdfPath - Absolute path to the PDF file.
 */
async function pdfToImageBase64(pdfPath: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wolf-'));
  const outputPrefix = path.join(tmpDir, 'page');
  try {
    // -r 200: 200 DPI — high enough for Claude Vision to read all text clearly
    // -png: output format
    // -singlefile: only first page, no page-number suffix
    await execFileAsync('pdftoppm', ['-r', '200', '-png', '-singlefile', pdfPath, outputPrefix]);
    const pngPath = `${outputPrefix}.png`;
    const pngBytes = await fs.readFile(pngPath);
    return pngBytes.toString('base64');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Builds the Claude prompt for a .tex-source resume.
 * Claude modifies bullet points to match the JD, preserving template structure.
 */
function buildTexPrompt(texContent: string, jdText: string, tailorNotes: string | null): string {
  return `You are an expert resume writer. The user has a LaTeX resume and wants it tailored to a specific job description.

INSTRUCTIONS:
- Rewrite bullet points under Experience, Projects, and Skills sections to better match the JD keywords and requirements.
- Preserve ALL LaTeX formatting, macros, and structure exactly — do not change \\resumeSubheading, \\resumeItem, section order, or any preamble content.
- Do not add or remove jobs, projects, or sections — only rewrite existing bullet text.
- Keep the same number of bullet points per entry.
- Return the complete .tex file. Do not add any explanation or markdown — only raw LaTeX.
- After \\end{document}, append a single line in this exact format (no newlines inside):
  %WOLF_META{"matchScore":0.85,"changes":["Rewrote X bullet to highlight Y","..."]}

${tailorNotes ? `ADDITIONAL INSTRUCTIONS FROM USER:\n${tailorNotes}\n` : ''}
JOB DESCRIPTION:
${jdText}

RESUME (.tex):
${texContent}`;
}

/**
 * Builds the Claude prompt for a PDF-source resume (image input).
 * Claude sees the visual layout and generates a new complete .tex.
 */
function buildPdfPrompt(jdText: string, tailorNotes: string | null): string {
  return `You are an expert resume writer and LaTeX typesetter. The image shows the user's current resume. Generate a tailored LaTeX resume targeting the job description below.

INSTRUCTIONS:
- Extract all content from the resume image (work experience, education, projects, skills, contact info).
- Match the visual style you see in the image — reproduce the layout, spacing, and formatting approach as closely as possible in LaTeX.
- Rewrite and reorder content to best match the JD — highlight relevant experience, use JD keywords naturally.
- Generate a complete, compilable .tex file. Start with \\documentclass and include everything through \\end{document}.
- The file must compile with pdflatex without any external .cls or .sty files not in a standard TeX Live installation.
- Return only raw LaTeX — no markdown code fences, no explanation.
- After \\end{document}, append a single line in this exact format (no newlines inside):
  %WOLF_META{"matchScore":0.85,"changes":["Highlighted X skill from JD","Reordered sections to lead with Y","..."]}

${tailorNotes ? `ADDITIONAL INSTRUCTIONS FROM USER:\n${tailorNotes}\n` : ''}
JOB DESCRIPTION:
${jdText}`;
}

/**
 * Parses the %WOLF_META comment appended by Claude after \\end{document}.
 * Returns defaults if the comment is missing or malformed.
 */
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

/** Validates that the output looks like a LaTeX document. */
function validateTex(tex: string): void {
  if (!tex.includes('\\begin{document}') || !tex.includes('\\end{document}')) {
    throw new Error('Claude returned invalid LaTeX — missing \\begin{document} or \\end{document}.');
  }
}

/**
 * Compiles a .tex file to PDF via pdflatex.
 * Runs twice to resolve cross-references.
 * Returns the output PDF path.
 */
async function compileTex(texPath: string): Promise<string> {
  const dir = path.dirname(texPath);
  const args = ['-interaction=nonstopmode', '-output-directory', dir, texPath];
  try {
    await execFileAsync('pdflatex', args);
    await execFileAsync('pdflatex', args); // second pass for references
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`pdflatex compilation failed: ${msg}`);
  }
  return texPath.replace(/\.tex$/, '.pdf');
}

/**
 * Converts the first page of a PDF to a PNG screenshot via pdftoppm.
 * Returns the screenshot path.
 */
async function pdfToScreenshot(pdfPath: string): Promise<string> {
  const dir = path.dirname(pdfPath);
  const base = path.basename(pdfPath, '.pdf');
  const outputPrefix = path.join(dir, base);
  await execFileAsync('pdftoppm', ['-r', '150', '-png', '-singlefile', pdfPath, outputPrefix]);
  return `${outputPrefix}.png`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Tailors a resume to a specific job and generates output files.
 *
 * @param options - Must include `jobId`; other fields override profile defaults.
 * @returns Paths to generated files, list of changes, and match score.
 * @throws If the job does not exist, resume file is missing, or Claude API fails.
 */
export async function tailor(options: TailorOptions): Promise<TailorResult> {
  const workspaceDir = process.cwd();
  await initDb(workspaceDir);

  // ── 1. Load job and profile ────────────────────────────────────────────────
  const job = await getJob(options.jobId);
  if (!job) throw new Error(`Job not found: ${options.jobId}`);

  const config = await loadConfig();
  const profileId = options.profileId ?? config.defaultProfileId;
  const profile = config.profiles.find(p => p.id === profileId);
  if (!profile) throw new Error(`Profile not found: ${profileId}`);

  const resumePath = options.resume ?? profile.resumePath;
  const ext = path.extname(resumePath).toLowerCase();

  // ── 2. Snapshot the master resume ─────────────────────────────────────────
  const snapshotFilename = await snapshotResume(resumePath, workspaceDir);

  // ── 3. Load tailor_notes.md if present (see issue #37) ────────────────────
  const tailorNotesPath = path.join(workspaceDir, 'data', 'jobs', job.id, 'tailor_notes.md');
  let tailorNotes: string | null = null;
  try {
    tailorNotes = await fs.readFile(tailorNotesPath, 'utf-8');
  } catch {
    // not present — fine
  }

  // ── 4. Call Claude ─────────────────────────────────────────────────────────
  const client = new Anthropic({ apiKey: process.env.WOLF_ANTHROPIC_API_KEY });
  let texOutput: string;

  if (ext === '.tex') {
    // .tex path: modify bullet points, preserve user's template
    const texContent = await fs.readFile(resumePath, 'utf-8');
    const prompt = buildTexPrompt(texContent, job.description, tailorNotes);
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    texOutput = response.content[0].type === 'text' ? response.content[0].text : '';

  } else if (ext === '.pdf') {
    // .pdf path: convert to image, pass to Claude Vision, generate new .tex
    const imageBase64 = await pdfToImageBase64(resumePath);
    const preamble = await readPreamble();
    const prompt = buildPdfPrompt(job.description, tailorNotes);
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
          },
          { type: 'text', text: prompt },
        ],
      }],
    });
    const body = response.content[0].type === 'text' ? response.content[0].text : '';
    // Strip any markdown code fences Claude might add despite instructions
    const cleanBody = body.replace(/^```(?:latex|tex)?\n?/m, '').replace(/\n?```$/m, '');
    texOutput = preamble + '\n' + cleanBody;

  } else {
    throw new Error(`Unsupported resume format: ${ext}. Use .tex or .pdf.`);
  }

  validateTex(texOutput);
  const { matchScore, changes } = parseWolfMeta(texOutput);

  // Strip the %WOLF_META line from the actual .tex file
  const cleanTex = texOutput.replace(/%WOLF_META\{.*\}\s*$/, '').trimEnd() + '\n';

  // ── 5. Write .tex output ───────────────────────────────────────────────────
  const tailoredDir = path.join(workspaceDir, 'data', 'tailored');
  await fs.mkdir(tailoredDir, { recursive: true });
  const tailoredTexPath = path.join(tailoredDir, `${job.id}.tex`);
  await fs.writeFile(tailoredTexPath, cleanTex, 'utf-8');

  // ── 6. Compile .tex → PDF ─────────────────────────────────────────────────
  const tailoredPdfPath = await compileTex(tailoredTexPath);

  // ── 7. Generate screenshot from PDF ───────────────────────────────────────
  const screenshotPath = await pdfToScreenshot(tailoredPdfPath);

  // ── 8. Update job record ───────────────────────────────────────────────────
  await updateJob(job.id, {
    tailoredResumePath: tailoredTexPath,
    tailoredResumePdfPath: tailoredPdfPath,
    screenshotPath,
    masterResumeSnapshot: snapshotFilename,
    status: 'reviewed',
  });

  return {
    tailoredTexPath,
    tailoredPdfPath,
    coverLetterMdPath: null,   // cover letter — issue #46
    coverLetterPdfPath: null,
    changes,
    matchScore,
  };
}
