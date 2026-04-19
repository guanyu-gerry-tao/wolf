import type { Job, JobQuery, JobStatus, JobUpdate } from "../types/job.js";

export interface JobRepository {
  get(id: string): Promise<Job | null>;
  save(job: Job): Promise<void>;
  saveMany(jobs: Job[]): Promise<void>;
  query(q: JobQuery): Promise<Job[]>;
  update(id: string, patch: JobUpdate): Promise<void>;
  updateMany(ids: string[], patch: JobUpdate): Promise<void>;
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
