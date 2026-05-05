import type { TierIndex } from "../scoringTiers.js";
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
 * Annual compensation in USD.
 *
 * β.10j: split into `salaryLow` + `salaryHigh` on Job. JD often advertises
 * a range ("$120k–$180k"); we store both endpoints.
 *
 * β.10k: unpaid sentinel removed. We use plain `number` everywhere with two
 * conventions:
 *   - `0`    → explicitly unpaid (internship / volunteer / equity-only).
 *   - `null` → unknown / not listed by the JD.
 * Callers MUST distinguish — a 0 minimum is a real signal, "unknown"
 * means the JD didn't say. Single-point comp ("$150k flat") → low=high.
 */
export type Salary = number;

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
  // β.10j/k: salary range. Both fields are plain numbers in USD.
  //   "$120k–$180k"            → salaryLow=120000, salaryHigh=180000
  //   "$150k flat"             → salaryLow=salaryHigh=150000
  //   Unpaid intern (no comp)  → salaryLow=0,      salaryHigh=0
  //   Unpaid base + $30k bonus → salaryLow=0,      salaryHigh=30000
  //   Not listed in JD         → salaryLow=null,   salaryHigh=null
  // Two distinct conventions:
  //   `0`    = explicit "unpaid" (real signal — user knowingly takes it).
  //   `null` = unknown (JD didn't say).
  // The pair (low, high) carries no implicit constraint — `low=0 high=N`
  // is valid (e.g. unpaid base with bonus ceiling). Coercion does NOT
  // validate the pair; the AI / scorer interprets shape.
  salaryLow: number | null;
  salaryHigh: number | null;
  workAuthorizationRequired: Sponsorship; // "unknown" means the JD did not state sponsorship.
  clearanceRequired: boolean;
  /**
   * @deprecated v3 — replaced by `tierAi` / `tierUser`. Existing column
   * kept for backward-compat with workspaces created on v1; new code
   * neither reads nor writes it. Will be dropped when the migration
   * framework lands.
   */
  score: number | null;
  /**
   * AI-generated markdown evaluation. v3 uses this column to hold the
   * full markdown blob (`## Tier`, `## Pros`, `## Cons` sections); v1
   * used it for plain prose justification. Always plain text.
   */
  scoreJustification: string | null;
  /**
   * AI tier verdict. Index into `TIER_NAMES` from `src/utils/scoringTiers.ts`.
   * Set by `wolf score` family of commands; never overwritten by user
   * actions. `null` until the job has been scored.
   */
  tierAi: TierIndex | null;
  /**
   * User tier override. Set by `wolf job set tier ...` and cleared by
   * `wolf job unlock`. Never overwritten by AI paths. The effective tier
   * for downstream commands is `tierUser ?? tierAi`.
   */
  tierUser: TierIndex | null;
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
  salaryLow?: number | null;
  salaryHigh?: number | null;
  workAuthorizationRequired?: Sponsorship;
  clearanceRequired?: boolean;

  // ---- pipeline state
  status?: JobStatus;
  error?: JobError | null;
  appliedProfileId?: string | null;
  score?: number | null;
  scoreJustification?: string | null;
  tierAi?: TierIndex | null;
  tierUser?: TierIndex | null;
  hasTailoredResume?: boolean;
  hasTailoredCoverLetter?: boolean;
  hasScreenshots?: boolean;
  hasOutreachDraft?: boolean;
}
