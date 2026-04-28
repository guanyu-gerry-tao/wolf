import type { JobListOptions, JobListResult } from '../utils/types/commands.js';

export interface JobApplicationService {
  // Validates and normalizes raw CLI options, then delegates to the
  // jobRepository to run the filtered list query and resolve company
  // names for display.
  list(options: JobListOptions): Promise<JobListResult>;
}
