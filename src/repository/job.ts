import type { Job, JobQuery, JobStatus, JobUpdate } from "../types/job.js";

export interface JobRepository {
  get(id: string): Promise<Job | null>;
  save(job: Job): Promise<void>;
  saveMany(jobs: Job[]): Promise<void>;
  query(q: JobQuery): Promise<Job[]>;
  update(id: string, patch: JobUpdate): Promise<void>;
  updateMany(ids: string[], patch: JobUpdate): Promise<void>;
  countByStatus(): Promise<Record<JobStatus, number>>;
  delete(id: string): Promise<void>;
}
