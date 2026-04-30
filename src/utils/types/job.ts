import { Sponsorship } from "./sponsorship.js";

/**
 * Every value a job's status column can hold — the single source of truth.
 * The `JobStatus` type below is derived from this array, so adding or
 * removing a value automatically updates the type with zero drift risk.
 *
 * Semantics per value:
 *   new                 just found by wolf, not yet reviewed
 *   reviewed            user has seen it, not dismissed — next step is to apply
 *   ignored             user manually dismissed; kept for recovery
 *   filtered            auto-dismissed by dealbreaker rules; kept for recovery
 *   applied             application submitted by wolf
 *   applied_previously  fill detected the role was already applied to before
 *                       wolf processed it; skipped
 *   interview           company reached out for interview
 *   offer               received an offer
 *   rejected            company passed, or user withdrew
 *   closed              role is closed, or user marked it closed after no
 *                       response for a long time
 *   error               something went wrong during processing
 */
export const ALL_JOB_STATUSES = [
  'new',
  'reviewed',
  'ignored',
  'filtered',
  'applied',
  'applied_previously',
  'interview',
  'offer',
  'rejected',
  'closed',
  'error',
] as const;

/** Where a job sits in the user's personal pipeline. */
export type JobStatus = (typeof ALL_JOB_STATUSES)[number];

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
 *
 * β.10j: split into `salaryLow` + `salaryHigh` on Job. JD often advertises
 * a range ("$120k–$180k"); we store both endpoints. `salaryLow` carries
 * the unpaid sentinel; `salaryHigh` is always numeric or null.
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
  location: string; // specific office location for this role
  remote: boolean;
  // β.10j: split salary into low/high. If the JD lists a range "$120k–
  // $180k" → salaryLow=120000, salaryHigh=180000. Single value "$150k" →
  // salaryLow=salaryHigh=150000 (or salaryLow=150000, salaryHigh=null —
  // both are valid; AI fillers should treat both as "single point").
  // Unpaid internship → salaryLow="unpaid", salaryHigh=null.
  // Unknown / not listed → salaryLow=null, salaryHigh=null.
  salaryLow: Salary | null;
  salaryHigh: number | null;
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
  // β.10h: replaced 5 nullable path strings with 4 booleans. Artifact files
  // live at convention paths under data/jobs/<jobDirName>/ — resolve via
  // JobRepository.getArtifactPath(id, kind) when a path is needed.
  hasTailoredResume: boolean;       // tailor produced resume.pdf
  hasTailoredCoverLetter: boolean;  // tailor produced cover_letter.html + cover_letter.pdf
  hasScreenshots: boolean;          // fill recorded screenshots/ directory
  hasOutreachDraft: boolean;        // reach drafted outreach.eml
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface JobQuery {
  status?: JobStatus | JobStatus[];
  companyIds?: string[];
  minScore?: number;
  /** Lower bound on createdAt (ISO 8601). Rows created on/after are included. */
  start?: string;
  /** Upper bound on createdAt (ISO 8601). Rows created on/before are included. */
  end?: string;
  source?: JobSource;
  /**
   * Free-form search terms. Each term is substring-matched (case-insensitive)
   * against the job's title, location, and its company's name. Terms are
   * OR'd together at the top level — giving multiple terms widens the match.
   */
  search?: string[];
  limit?: number;
}

/**
 * Partial-update patch — every field on the `jobs` row that's user-editable
 * appears here. System-managed columns (`id`, `companyId`, `createdAt`,
 * `updatedAt`) are intentionally NOT updatable through this surface.
 *
 * Two layers consume this:
 *
 *   - **pipeline writers** (score / tailor / fill / reach) typically patch
 *     a small targeted slice (e.g. `{ status, score }` after scoring).
 *   - **`wolf job set <field>`** patches exactly one field at a time, with
 *     the user-supplied value coerced to the field's runtime type.
 *
 * Adding a new editable column means:
 *   - add it here,
 *   - add it to `JOB_FIELDS` in `src/utils/jobFields.ts` (drives CLI),
 *   - extend `sqliteJobRepositoryImpl.update` if it doesn't already
 *     pass through unknown keys (drizzle's `set(patch)` does — no change
 *     needed for typical scalar additions).
 */
export interface JobUpdate {
  // ---- core (set by `wolf add` / `wolf hunt`; rarely re-edited)
  title?: string;
  url?: string;
  source?: JobSource;
  location?: string;
  remote?: boolean;
  salaryLow?: Salary | null;
  salaryHigh?: number | null;
  workAuthorizationRequired?: Sponsorship;
  clearanceRequired?: boolean;

  // ---- pipeline state
  status?: JobStatus;
  error?: JobError | null;
  appliedProfileId?: string | null;
  score?: number | null;
  scoreJustification?: string | null;
  hasTailoredResume?: boolean;
  hasTailoredCoverLetter?: boolean;
  hasScreenshots?: boolean;
  hasOutreachDraft?: boolean;
}
