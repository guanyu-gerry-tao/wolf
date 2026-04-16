import { randomUUID } from 'node:crypto';
import type { AddOptions, AddResult } from '../../types/index.js';
import { createAppContext, type AppContext } from '../../cli/appContext.js';

/**
 * Stores a single job submitted by an AI orchestrator (MCP-only entry point).
 *
 * Designed for AI-driven flows where the user shares a job with Claude/OpenClaw
 * (screenshot, pasted JD, or URL content). The AI caller is responsible for
 * extracting structured fields before calling this function — wolf only stores.
 *
 * Typical chain: wolf_add → wolf_score({ single: true }) → wolf_tailor
 *
 * @param options - Structured job data extracted by the AI caller.
 * @param ctx - AppContext for dependency injection; defaults to real SQLite-backed context.
 * @returns jobId for chaining into wolf_score or wolf_tailor.
 */
export async function add(
  options: AddOptions,
  ctx: AppContext = createAppContext(),
): Promise<AddResult> {
  const now = new Date().toISOString();

  // Reuse existing company record if one exists for this name; otherwise create a new one.
  let company = await ctx.companyRepository.getByName(options.company);
  if (!company) {
    company = {
      id: randomUUID(),
      name: options.company,
      domain: null,
      linkedinUrl: null,
      size: null,
      industry: null,
      headquartersLocation: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };
    await ctx.companyRepository.upsert(company);
  }

  const jobId = randomUUID();
  await ctx.jobRepository.save({
    id: jobId,
    title: options.title,
    companyId: company.id,
    url: options.url ?? '',
    source: 'Other',
    description: options.jdText,
    location: '',
    remote: false,
    salary: null,
    workAuthorizationRequired: 'no sponsorship',
    clearanceRequired: false,
    score: null,
    scoreJustification: null,
    status: 'new',
    error: null,
    appliedProfileId: null,
    tailoredResumeTexPath: null,
    tailoredResumePdfPath: null,
    coverLetterHtmlPath: null,
    coverLetterPdfPath: null,
    screenshotPath: null,
    outreachDraftPath: null,
    createdAt: now,
    updatedAt: now,
  });

  return { jobId };
}
