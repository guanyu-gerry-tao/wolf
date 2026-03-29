/**
 * resume-snapshot.ts — Master resume versioning via content hash.
 *
 * Each time wolf tailor runs, it hashes the user's resume file and saves a
 * copy to data/resume/snapshots/master_<hash>.<ext> if not already present.
 * The snapshot filename is stored on the job record (masterResumeSnapshot),
 * making it possible to retrieve the exact resume that was used for any tailor run.
 *
 * Users never interact with this directly — it runs silently on every tailor call.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Ensures a snapshot exists for the given resume file.
 *
 * - Computes SHA-256 hash of the file contents
 * - If `snapshots/master_<hash>.<ext>` already exists, returns immediately
 * - Otherwise copies the file into the snapshots directory
 *
 * @param resumePath - Absolute path to the user's resume file (.tex or .pdf)
 * @param workspaceDir - Absolute path to the workspace root (contains data/)
 * @returns The snapshot filename, e.g. "master_a3f2c1.tex"
 */
export async function snapshotResume(resumePath: string, workspaceDir: string): Promise<string> {
  const ext = path.extname(resumePath).toLowerCase();
  const contents = await fs.readFile(resumePath);
  const hash = crypto.createHash('sha256').update(contents).digest('hex').slice(0, 8);
  const snapshotFilename = `master_${hash}${ext}`;
  const snapshotPath = path.join(workspaceDir, 'data', 'resume', 'snapshots', snapshotFilename);

  try {
    await fs.access(snapshotPath);
    // Already exists — reuse
  } catch {
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.copyFile(resumePath, snapshotPath);
  }

  return snapshotFilename;
}

/**
 * Returns the absolute path to a snapshot file.
 *
 * @param snapshotFilename - e.g. "master_a3f2c1.tex"
 * @param workspaceDir - Absolute path to the workspace root
 */
export function resolveSnapshot(snapshotFilename: string, workspaceDir: string): string {
  return path.join(workspaceDir, 'data', 'resume', 'snapshots', snapshotFilename);
}
