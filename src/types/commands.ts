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

export interface ScoreOptions {
  profileId?: string;                    // defaults to defaultProfileId
  jobIds?: string[];                     // score only specific jobs; defaults to all with score: null
  poll?: boolean;                        // default false — if true, poll pending batches instead of submitting new
  aiProvider?: 'anthropic' | 'openai';  // defaults to anthropic
}

export interface ScoreResult {
  submitted: number;   // jobs submitted for scoring
  filtered: number;    // jobs eliminated by dealbreakers
  polled?: number;     // pending batches polled (only when poll: true)
}

export interface TailorOptions {
  jobId: string;
  profileId?: string;      // defaults to defaultProfileId
  resume?: string;         // path to .tex; defaults to profile.resumePath
  coverLetter?: boolean;   // default true
  diff?: boolean;          // show before/after comparison
}

export interface TailorResult {
  tailoredTexPath: string | null;    // null if resume was not re-tailored
  tailoredPdfPath: string | null;
  coverLetterMdPath: string | null;
  coverLetterPdfPath: string | null;
  changes: string[];
  matchScore: number;
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
