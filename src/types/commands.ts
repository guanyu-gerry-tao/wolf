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
  url?: string;         // original job posting URL, if available
  profileId?: string;   // defaults to defaultProfileId
}

export interface AddResult {
  jobId: string;        // DB-assigned ID for chaining into wolf_score or wolf_tailor
}

export interface ScoreOptions {
  profileId?: string;                    // defaults to defaultProfileId
  jobIds?: string[];                     // score only specific jobs; defaults to all with score: null
  poll?: boolean;                        // default false — if true, poll pending batches instead of submitting new
  single?: boolean;                      // default false — if true, skip Batch API and score synchronously via Haiku
  aiModel?: string;   // overrides AppConfig.score.model for this call; format "<provider>/<model>"
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
  resume?: string;         // path to .tex; defaults to profile.resumePath
  coverLetter?: boolean;   // default true
  diff?: boolean;          // show before/after comparison
  aiModel?: string;   // overrides AppConfig.tailor.model for this call; format "<provider>/<model>"
  // Pre-analysis guidance to steer the analyst agent for this job. When set,
  // gets written to data/<jobId>/src/hint.md and treated as authoritative
  // input by the analyst. Pass "" to clear an existing hint file.
  hint?: string;
}

export interface TailorResult {
  tailoredPdfPath: string | null;
  coverLetterHtmlPath: string | null;
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
