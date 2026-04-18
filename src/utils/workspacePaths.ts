/**
 * Pure helpers that compose the on-disk paths for a job's or a company's
 * workspace directory. All prose artifacts (jd.md, info.md, hint.md, brief.md,
 * resume.html/pdf, cover_letter.html/pdf) live under these directories.
 *
 * Directory naming is derived from human-readable labels plus a shortened id
 * so the layout is greppable from the filesystem.
 *   jobs/      <company>_<title>_<jobIdShort8>
 *   companies/ <company>_<companyIdShort8>
 */
import path from 'node:path';

const UNSAFE_CHARS = /[^a-zA-Z0-9-]/g;
const MAX_LABEL_LENGTH = 40;
const SHORT_ID_LENGTH = 8;

// Converts free-form labels (company names, job titles) into directory-safe
// tokens. Non-alphanumeric chars become underscores; runs collapsed; capped.
function safeLabel(s: string): string {
  return s.replace(UNSAFE_CHARS, '_').replace(/_+/g, '_').slice(0, MAX_LABEL_LENGTH);
}

// UUIDs compress to the first 8 hex chars — ample for local disambiguation.
function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, SHORT_ID_LENGTH);
}

export function jobDirName(companyName: string, title: string, jobId: string): string {
  return `${safeLabel(companyName)}_${safeLabel(title)}_${shortId(jobId)}`;
}

export function companyDirName(companyName: string, companyId: string): string {
  return `${safeLabel(companyName)}_${shortId(companyId)}`;
}

export function jobDir(
  workspaceDir: string,
  companyName: string,
  title: string,
  jobId: string,
): string {
  return path.join(workspaceDir, 'data', 'jobs', jobDirName(companyName, title, jobId));
}

export function companyDir(
  workspaceDir: string,
  companyName: string,
  companyId: string,
): string {
  return path.join(workspaceDir, 'data', 'companies', companyDirName(companyName, companyId));
}
