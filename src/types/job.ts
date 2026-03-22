import type { CompanySize } from "./company.js";

/** Where a job sits in the user's personal pipeline. */
export type JobStatus =
  | "new"        // just found by wolf, not yet reviewed
  | "reviewed"   // user has seen it, not dismissed — next step is to apply
  | "ignored"    // user manually dismissed; kept for recovery
  | "filtered"   // auto-dismissed by dealbreaker rules; kept for recovery
  | "applied"    // application submitted
  | "interview"  // company reached out for interview
  | "offer"      // received an offer
  | "rejected";  // company passed, or user withdrew

/**
 * Annual compensation in USD, or "unpaid" for internships/volunteer roles.
 * Using a union type forces explicit handling of the unpaid case.
 */
export type Salary = number | "unpaid";

/** Where wolf found the job. Set by each provider — not an exhaustive enum. */
export type JobSource = string;

/**
 * One job listing — the central data object stored in SQLite.
 * Every wolf command reads from or writes to Job records.
 */
export interface Job {
  id: string;                              // uuid
  title: string;                           // e.g. "Software Engineer Intern"
  companyId: string;                       // foreign key → Company.id
  url: string;                             // application or listing URL
  source: JobSource;
  description: string;                     // full JD text
  location: string;                        // specific office location for this role
  remote: boolean;
  salary: Salary | null;                   // null if not listed
  workAuthorizationRequired: string | null; // e.g. "no sponsorship", "US citizens only"
  score: number | null;                    // AI relevance score 0.0–1.0; null if unscored
  scoreJustification: string | null;       // AI-generated explanation: why the job scored this way,
                                           // what's a strong match, and any flags or concerns.
                                           // Persisted permanently — shown in wolf status and used
                                           // by AI orchestrators to present results to the user.
  status: JobStatus;
  appliedProfileId: string | null;         // which profile was used; null if not yet applied
  tailoredResumePath: string | null;
  tailoredResumePdfPath: string | null;
  coverLetterPath: string | null;
  coverLetterPdfPath: string | null;
  screenshotPath: string | null;
  outreachDraftPath: string | null;
  createdAt: string;                       // ISO 8601
  updatedAt: string;                       // ISO 8601
}

export interface JobQuery {
  status?: JobStatus | JobStatus[];
  companyIds?: string[];
  minScore?: number;
  since?: string;          // ISO 8601
  source?: JobSource;
  limit?: number;
  offset?: number;
}

export interface JobUpdate {
  status?: JobStatus;
  appliedProfileId?: string | null;
  score?: number | null;
  scoreJustification?: string | null;
  tailoredResumePath?: string | null;
  tailoredResumePdfPath?: string | null;
  coverLetterPath?: string | null;
  coverLetterPdfPath?: string | null;
  screenshotPath?: string | null;
  outreachDraftPath?: string | null;
}

// Re-export CompanySize so callers that need it alongside Job don't need a second import
export type { CompanySize };
