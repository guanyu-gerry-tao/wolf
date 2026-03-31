import type { Job, JobStatus } from "./job.js";

export interface HuntOptions {
  profileId?: string;      // defaults to defaultProfileId
  role?: string;           // overrides profile.targetRoles
  location?: string;       // overrides profile.targetLocations
  companyIds?: string[];   // restrict to specific companies
  providers?: string[];    // override enabled providers
  maxResults?: number;     // override config.hunt.maxResults
}

export interface HuntResult {
  ingestedCount: number;   // total jobs fetched across all providers
  newCount: number;        // jobs not previously seen (after dedup)
}

export interface AddOptions {
  title: string;
  company: string;
  jdText: string;
  location: string;                              // extracted from JD by AI caller
  remote: boolean;                               // extracted from JD by AI caller
  url?: string;                                  // original job posting URL, if available
  salary?: number | 'unpaid';                    // extracted from JD by AI caller, if present
  workAuthorizationRequired?: string;            // extracted from JD by AI caller, if present
  source?: string;                               // defaults to 'manual'; use 'browser' for extension, etc.
  profileId?: string;                            // defaults to defaultProfileId
}

export interface AddResult {
  jobId: string;        // DB-assigned ID for chaining into wolf_score or wolf_tailor
}

export interface ScoreOptions {
  profileId?: string;                    // defaults to defaultProfileId
  jobIds?: string[];                     // score only specific jobs; defaults to all with score: null
  poll?: boolean;                        // default false — if true, poll pending batches instead of submitting new
  single?: boolean;                      // default false — if true, skip Batch API and score synchronously via Haiku
  aiProvider?: 'anthropic' | 'openai';  // defaults to anthropic
}

export interface ScoreResult {
  submitted: number;   // jobs submitted for scoring
  filtered: number;    // jobs eliminated by dealbreakers
  polled?: number;     // pending batches polled (only when poll: true)
  // Populated only when single: true — immediate result for AI orchestrators to present to user
  singleScore?: number;
  singleComment?: string;  // same as Job.scoreJustification; returned immediately so AI can present inline
}

export interface TailorOptions {
  jobId: string;
  profileId?: string;      // defaults to defaultProfileId
  coverLetter?: boolean;   // default false — generate cover letter in addition to resume
  diff?: boolean;          // show before/after comparison
}

export interface TailorResult {
  tailoredTexPath: string | null;
  tailoredPdfPath: string | null;
  coverLetterMdPath: string | null;
  coverLetterPdfPath: string | null;
  screenshotPath: string | null;
  changes: string[];
  matchScore: number;
}

export interface TemplategenOptions {
  type: 'resume' | 'cl';   // resume or cover letter template
  prompt?: string;          // optional user instructions for Claude
  profileId?: string;       // defaults to defaultProfileId
}

export interface TemplategenResult {
  texPath: string;          // absolute path to generated .tex (under general_resume/ or general_cl/)
  pdfPath: string;          // compiled PDF for review
  screenshotPath: string;   // first-page PNG for preview
}

export interface FormField {
  name: string;
  type: string;            // "text", "email", "file", "select", "checkbox", etc.
  required: boolean;
  value: string | null;    // null if no mapping found from profile
}

export interface FillOptions {
  jobId: string;
  profileId?: string;          // defaults to defaultProfileId
  dryRun?: boolean;            // default true — preview only, don't submit
  resumePath?: string;         // defaults to tailored resume for this job
  coverLetterPath?: string;    // defaults to tailored CL for this job
}

export interface FillResult {
  fields: FormField[];
  submitted: boolean;
  screenshotPath: string | null;
}

export interface Contact {
  name: string;
  title: string;               // e.g. "Engineering Manager"
  companyId: string | null;    // null if company not in database
  companyName: string;         // always present for display even if companyId is null
  email: string | null;
  emailInferred: boolean;      // true if guessed from pattern (e.g. first.last@company.com)
  linkedinUrl: string | null;
}

export interface ReachOptions {
  jobId: string;
  profileId?: string;   // defaults to defaultProfileId; determines sender name/email
  send?: boolean;       // default false — draft only
}

export interface ReachResult {
  contacts: Contact[];
  draftPath: string;
  sent: boolean;
}

export interface StatusOptions {
  status?: JobStatus;
  companyIds?: string[];
  minScore?: number;
  since?: string;       // ISO 8601
}

export interface StatusResult {
  jobs: Job[];
  total: number;
  byStatus: Record<JobStatus, number>;
}

/**
 * Plugin interface (strategy pattern) for job sources.
 * Each provider independently implements this interface.
 * wolf hunt iterates all enabled providers, merges and deduplicates raw results.
 * Scoring is handled separately by wolf score.
 */
export interface JobProvider {
  name: string;
  hunt(options: HuntOptions): Promise<object[]>;  // returns raw JSON objects from the data source
}
