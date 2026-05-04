import type { Job, JobQuery, JobStatus, JobUpdate } from "../utils/types/job.js";

/**
 * Repository for the `jobs` table plus per-job workspace files. SQLite
 * holds structured metadata only; free-form prose (JD text, screenshots,
 * tailoring brief, rendered HTML/PDF) lives on disk under
 * `data/jobs/<company>_<title>_<jobIdShort>/` so the workspace is
 * grep-friendly and hand-editable.
 */
export interface JobRepository {
  /** Fetches one job by id, or `null` if missing. */
  get(id: string): Promise<Job | null>;
  /** Inserts or replaces a job row by `id`. */
  save(job: Job): Promise<void>;
  /** Bulk variant — wraps `save` in a single transaction for hunt ingestion. */
  saveMany(jobs: Job[]): Promise<void>;
  /** Filtered list query honoring `limit`. */
  query(q: JobQuery): Promise<Job[]>;
  /** Partial update — touches only the fields named in `patch`. */
  update(id: string, patch: JobUpdate): Promise<void>;
  /** Bulk partial update — same `patch` applied to every id. */
  updateMany(ids: string[], patch: JobUpdate): Promise<void>;
  /** Counts grouped by status, e.g. `{ new: 12, applied: 3, … }`. */
  countByStatus(): Promise<Record<JobStatus, number>>;

  /** Total number of jobs in the DB, regardless of status. */
  countAll(): Promise<number>;

  /**
   * Number of jobs whose tailor pipeline has produced a resume PDF.
   * Used by the status dashboard's "tailored" counter.
   */
  countWithTailoredResume(): Promise<number>;

  /** Number of jobs that do not yet have both tailored resume and cover letter artifacts. */
  countWithoutCompleteTailor(): Promise<number>;

  /** Total number of rows matching a query, ignoring the query's `limit`. */
  countMatching(q: JobQuery): Promise<number>;

  /** Removes the job row. Workspace files on disk are NOT touched. */
  delete(id: string): Promise<void>;

  /**
   * Resolve the absolute workspace directory for a job — the place on disk
   * where jd.md, the tailor src/ folder, and the rendered PDFs all live.
   * Layout: `<workspace>/data/jobs/<company>_<title>_<jobIdShort>/`.
   */
  getWorkspaceDir(id: string): Promise<string>;

  /** Read the job description stored at `<workspaceDir>/jd.md`. */
  readJdText(id: string): Promise<string>;

  /** Write the job description to `<workspaceDir>/jd.md`, creating the dir if needed. */
  writeJdText(id: string, jdText: string): Promise<void>;

  /**
   * Resolve the convention path for one of the per-job artifacts. β.10h
   * replaced the 5 nullable path columns with 4 booleans + this helper —
   * the actual path is always derivable from `getWorkspaceDir(id)` plus a
   * fixed filename, so persisting it was redundant.
   *
   * Returns the path even if the file does not yet exist. Callers should
   * read the corresponding `hasX` flag on the Job row to decide whether
   * the artifact has been produced; this method does NOT stat the disk.
   *
   * **Stale-flag note**: `hasX = true` means "wolf produced this artifact",
   * not "the file currently exists on disk". A user who manually deletes
   * the rendered PDF leaves the flag set; consumers reading the path
   * should handle ENOENT gracefully (re-run the relevant pipeline step
   * rather than hard-fail).
   */
  getArtifactPath(id: string, kind: ArtifactKind): Promise<string>;
}

/** One of the per-job artifact kinds wolf knows how to locate by convention. */
export type ArtifactKind =
  | 'resume_pdf'         // <workspaceDir>/resume.pdf
  | 'cover_letter_html'  // <workspaceDir>/src/cover_letter.html
  | 'cover_letter_pdf'   // <workspaceDir>/cover_letter.pdf
  | 'screenshot_dir'     // <workspaceDir>/screenshots/
  | 'outreach_draft';    // <workspaceDir>/outreach.eml
