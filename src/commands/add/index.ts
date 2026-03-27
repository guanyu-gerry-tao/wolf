/**
 * add/index.ts — Single job ingestion (MCP-only entry point).
 *
 * Stores one job submitted by an AI orchestrator (Claude / OpenClaw).
 * The AI caller is responsible for extracting structured fields from the
 * user's raw input (screenshot, pasted JD, URL content) before calling this.
 * wolf only stores — it does not parse or re-extract.
 *
 * ## Typical AI-orchestrated flow
 *
 *   User: "I found this job, looks interesting" + shares content
 *   AI: extracts { title, company, jdText, url?, location, remote, salary?, workAuthorizationRequired? }
 *   AI: calls wolf_add({ title, company, jdText, url, location, remote })
 *     → wolf saves job with status: 'new', score: null
 *     → returns { jobId }
 *   AI: calls wolf_score({ jobIds: [jobId], single: true })
 *     → synchronous Haiku scoring, returns score + comment
 *   AI: presents results to user, offers wolf_tailor
 *
 * ## source field
 *
 * Jobs added via wolf_add are stored with source = 'manual'.
 * This distinguishes them from provider-ingested jobs in wolf status.
 */

import type { AddOptions, AddResult } from '../../types/index.js';
import { initDb, upsertCompany, saveJob } from '../../utils/db.js';

/**
 * Saves a single AI-structured job to the local database.
 *
 * @param options - Structured job data extracted by the AI caller.
 *   - title: job title
 *   - company: company name (used to upsert a Company record)
 *   - jdText: full job description text
 *   - location: work location extracted from JD (e.g. "San Francisco, CA")
 *   - remote: whether the role is remote, extracted from JD
 *   - url: original job posting URL (optional; defaults to empty string if not provided)
 *   - salary: compensation extracted from JD (optional)
 *   - workAuthorizationRequired: sponsorship info extracted from JD (optional)
 *   - profileId: reserved for future use
 * @returns jobId — the DB-assigned id for chaining into wolf_score or wolf_tailor.
 * @throws If the DB cannot be initialized (e.g. wolf.toml not found in cwd).
 */
export async function add(options: AddOptions): Promise<AddResult> {
  // Ensure DB is ready (throws if not, e.g. missing wolf.toml)
  await initDb(process.cwd());

  const companyId = await upsertCompany({
    name: options.company,
    domain: null,
    linkedinUrl: null,
    size: null,
    industry: null,
    headquartersLocation: null,
    notes: null,
  });

  const jobId = await saveJob({
    title: options.title,
    companyId,
    url: options.url ?? '',
    source: options.source ?? 'manual',
    description: options.jdText,
    location: options.location,
    remote: options.remote,
    salary: options.salary ?? null,
    workAuthorizationRequired: options.workAuthorizationRequired ?? null,
    score: null,
    scoreJustification: null,
    status: 'new',
    appliedProfileId: null,
    tailoredResumePath: null,
    tailoredResumePdfPath: null,
    coverLetterPath: null,
    coverLetterPdfPath: null,
    screenshotPath: null,
    outreachDraftPath: null,
  });

  return { jobId };
}
