import type { JobListOptions, JobListResult } from '../utils/types/commands.js';
import type { JobFieldMeta } from '../utils/jobFields.js';

/**
 * Result of `wolf job show <id>` — every column of the SQLite row plus
 * the `description_md` JD prose. CLI prints this verbatim; AI / MCP
 * consumers can also use the JSON form.
 */
export interface JobShowResult {
  /** All flat columns on the `jobs` row, including system-managed ones. */
  fields: Record<string, unknown>;
  /** JD prose (jobs.description_md column). Empty string if unset. */
  descriptionMd: string;
  /** Display-resolved company name (looked up via `CompanyRepository`). */
  companyName: string;
}

/**
 * Result of `wolf job set <id> <field> <value>` — what landed and what
 * was overwritten. CLI prints this for human-readable confirmation.
 */
export interface JobSetResult {
  id: string;
  field: string;
  /** Previous value as a printable string ('' for nullish). */
  oldValue: string;
  /** New value as a printable string. */
  newValue: string;
}

/**
 * Use case for `wolf job` subcommands. Wraps the `JobRepository` with
 * input coercion (CLI strings → typed values) and field-set validation
 * (rejects unknown / system-managed fields).
 */
export interface JobApplicationService {
  /**
   * Returns matching jobs (with display-resolved company names) plus the
   * unlimited `totalMatching` count. The CLI uses `totalMatching` to render
   * the overflow footer (`... N more — use --limit`).
   */
  list(options: JobListOptions): Promise<JobListResult>;

  /** Returns every column of the row + JD prose + company name. */
  show(id: string): Promise<JobShowResult>;

  /**
   * Reads one field by name. Rejects unknown names. `description_md` is
   * read from disk via `JobRepository.readJdText`. Returns the value
   * stringified for piping (`'' for null/undefined`).
   */
  getField(id: string, name: string): Promise<string>;

  /**
   * Coerces `valueStr` to the field's type and persists it. Rejects
   * unknown / system-managed fields. For `description_md`, writes via
   * `JobRepository.writeJdText`. Returns before/after for CLI display.
   */
  setField(id: string, name: string, valueStr: string): Promise<JobSetResult>;

  /** Returns the JOB_FIELDS metadata table (subset filterable by required-only). */
  fields(opts?: { requiredOnly?: boolean; name?: string }): JobFieldMeta[];
}
