/**
 * Represents the sponsorship status for a job.
 */
export type Sponsorship =
  | "no sponsorship" // job doesn't offer sponsorship
  | "Green card" // offering green card sponsorship, or equivalent for other countries (e.g. Canada's permanent residency sponsorship)
  | "Work visa" // offering H-1B sponsorship, L1 or O1, or equivalent for other countries (e.g. Canada's LMIA work permits)
  | "OPT" // offering OPT STEM extension eligibility, or equivalent for other countries (e.g. Canada's post-graduation work permits)
  | "CPT"; // offering CPT sponsorship, or equivalent for other countries (e.g. Canada's co-op work permits)

/**
 * Represents the candidate's work authorization status.
 * Common values listed for reference; free-form strings are allowed to support
 * multi-status situations (e.g. "H-1B + 485 pending") or non-US contexts.
 *
 * Common values: "H-1B" | "L1" | "OPT" | "CPT" | "no limit"
 */
export type Status = string;
