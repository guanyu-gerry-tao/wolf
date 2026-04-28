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
}
