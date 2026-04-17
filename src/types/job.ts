import type { CompanySize } from "./company.js";
import { Sponsorship } from "./sponsorship.js";

/** Where a job sits in the user's personal pipeline. */
export type JobStatus =
  | "new" // just found by wolf, not yet reviewed
  | "reviewed" // user has seen it, not dismissed — next step is to apply
  | "ignored" // user manually dismissed; kept for recovery
  | "filtered" // auto-dismissed by dealbreaker rules; kept for recovery
  | "applied" // application submitted by wolf
  | "applied_previously" // fill detected the role was already applied to before wolf processed it; skipped
  | "interview" // company reached out for interview
  | "offer" // received an offer
  | "rejected" // company passed, or user withdrew
  | "closed" // role is closed, or user marked it as closed after no response for a long time
  | "error"; // something went wrong during processing

export type JobError =
  // score
  | "score_extraction_error"      // AI failed to extract structured fields from JD
  | "score_error"                 // AI failed to score the job
  // tailor
  | "tailor_resume_error"         // AI failed to rewrite resume bullets
  | "tailor_cover_letter_error"   // AI failed to generate cover letter
  | "tailor_compile_error"        // LaTeX compile failed (xelatex / md-to-pdf)
  // fill
  | "fill_detection_error"        // failed to detect form fields
  | "fill_submit_error"           // failed to submit the form
  // reach
  | "reach_contact_error"         // failed to find HR contacts
  | "reach_draft_error"           // AI failed to draft outreach email
  | "reach_send_error";           // Gmail API failed to send email

/**
 * Annual compensation in USD, or "unpaid" for internships/volunteer roles.
 * Using a union type forces explicit handling of the unpaid case.
 */
export type Salary = number | "unpaid";

/** Where wolf found the job. Set by each provider — not an exhaustive enum. */
export type JobSource =
  | "LinkedIn"
  | "Indeed"
  | "handshake"
  | "Company website"
  | "Other";

/**
 * One job listing — the central data object stored in SQLite.
 * Every wolf command reads from or writes to Job records.
 */
export interface Job {
  id: string; // uuid
  title: string; // e.g. "Software Engineer Intern"
  companyId: string; // foreign key → Company.id
  url: string; // application or listing URL
  source: JobSource;
  description: string; // full JD text
  location: string; // specific office location for this role
  remote: boolean;
  salary: Salary | null; // null if not listed
  workAuthorizationRequired: Sponsorship; // e.g. "no sponsorship", "US citizens only"
  clearanceRequired: boolean;
  score: number | null; // AI relevance score 0.0–1.0; null if unscored
  scoreJustification: string | null; // AI-generated explanation: why the job scored this way,
  // what's a strong match, and any flags or concerns.
  // Persisted permanently — shown in wolf status and used
  // by AI orchestrators to present results to the user.
  status: JobStatus;
  error: JobError | null;          // set when status is "error"; null otherwise
  appliedProfileId: string | null; // which profile was used; null if not yet applied
  tailoredResumePdfPath: string | null; // path to the tailored resume PDF
  coverLetterHtmlPath: string | null; // path to the cover letter HTML file generated
  coverLetterPdfPath: string | null; // path to the PDF generated
  screenshotPath: string | null; // path to the screenshot folders when applying via browser
  outreachDraftPath: string | null; // path to the outreach email draft (.eml)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface JobQuery {
  status?: JobStatus | JobStatus[];
  companyIds?: string[];
  minScore?: number;
  since?: string; // ISO 8601
  source?: JobSource;
  limit?: number;
}

export interface JobUpdate {
  status?: JobStatus;
  error?: JobError | null;
  appliedProfileId?: string | null;
  score?: number | null;
  scoreJustification?: string | null;
  tailoredResumePdfPath?: string | null;
  coverLetterHtmlPath?: string | null;
  coverLetterPdfPath?: string | null;
  screenshotPath?: string | null;
  outreachDraftPath?: string | null;
}
