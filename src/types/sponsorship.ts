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
 */
export type Status =
  | "H-1B" // H-1B visa, or equivalent for other countries (e.g. Canada's LMIA work permits)
  | "L1"   // L1 visa or equivalent single employer work permit
  | "OPT"  // OPT STEM extension, or equivalent for other countries (e.g. Canada's post-graduation work permits)
  | "CPT"  // CPT, or equivalent for other countries (e.g. Canada's co-op work permits)
  | "no limit"; // e.g. US citizen or GC holder, H4 EAD, 485 EAD, or equivalent for other countries (e.g. Canadian permanent residents, UK settled status)
