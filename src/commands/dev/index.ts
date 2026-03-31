/**
 * dev/index.ts — developer utilities for cleaning up test artifacts.
 *
 * wolf dev clean --jobs         delete job output dirs + clear DB job records
 * wolf dev clean --all          above + delete API-generated templates (general_resume/, general_cl/)
 * wolf dev clean --dangerousall wipe entire data/ directory, leave empty shell + wolf.toml intact
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

async function removeDir(p: string): Promise<void> {
  if (await exists(p)) {
    await fs.rm(p, { recursive: true, force: true });
  }
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`${question} (yes/no): `);
  rl.close();
  return answer.trim().toLowerCase() === 'yes';
}

/** Returns all profile directories inside data/ (e.g. data/default_Default/) */
async function profileDirs(dataDir: string): Promise<string[]> {
  if (!(await exists(dataDir))) return [];
  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => path.join(dataDir, e.name));
}

/**
 * Returns all job output directories inside a profile dir.
 * Job dirs are any subdirectory that is NOT general_resume or general_cl.
 */
async function jobDirs(profileDir: string): Promise<string[]> {
  if (!(await exists(profileDir))) return [];
  const entries = await fs.readdir(profileDir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && e.name !== 'general_resume' && e.name !== 'general_cl')
    .map(e => path.join(profileDir, e.name));
}

async function deleteDb(workspaceDir: string): Promise<void> {
  const dbPath = path.join(workspaceDir, 'wolf.sqlite');
  if (await exists(dbPath)) {
    await fs.unlink(dbPath);
  }
}

// ---------------------------------------------------------------------------
// Clean levels
// ---------------------------------------------------------------------------

/**
 * --jobs: remove all per-job output directories and clear the DB job records.
 * Keeps resume.txt, style_ref.jpg, general_resume/, general_cl/, wolf.toml.
 */
export async function cleanJobs(workspaceDir: string): Promise<void> {
  const dataDir = path.join(workspaceDir, 'data');
  const profiles = await profileDirs(dataDir);

  let removed = 0;
  for (const pd of profiles) {
    const jobs = await jobDirs(pd);
    for (const jd of jobs) {
      await removeDir(jd);
      removed++;
    }
  }

  await deleteDb(workspaceDir);
  console.log(`Removed ${removed} job director${removed === 1 ? 'y' : 'ies'} and deleted wolf.sqlite.`);
}

/**
 * --all: cleanJobs + remove API-generated templates (general_resume/, general_cl/).
 * Keeps resume.txt, style_ref.jpg, wolf.toml.
 */
export async function cleanAll(workspaceDir: string): Promise<void> {
  await cleanJobs(workspaceDir);

  const dataDir = path.join(workspaceDir, 'data');
  const profiles = await profileDirs(dataDir);

  let removed = 0;
  for (const pd of profiles) {
    for (const name of ['general_resume', 'general_cl']) {
      const target = path.join(pd, name);
      if (await exists(target)) {
        await removeDir(target);
        removed++;
      }
    }
  }

  console.log(`Removed ${removed} template director${removed === 1 ? 'y' : 'ies'} (general_resume, general_cl).`);
  console.log('Note: run wolf_templategen to regenerate resume templates (requires API call).');
}

/**
 * --dangerousall: wipe everything in data/ and wolf.sqlite. Leaves empty data/ folder.
 * Requires typed confirmation.
 */
export async function cleanDangerousAll(workspaceDir: string): Promise<void> {
  const dataDir = path.join(workspaceDir, 'data');
  const dbPath = path.join(workspaceDir, 'wolf.sqlite');

  console.log('\n⚠️  DANGEROUS: this will delete:');
  console.log(`  • All contents of ${dataDir}`);
  console.log(`  • ${dbPath}`);
  console.log('  wolf.toml will be preserved.\n');

  const ok = await confirm('Type "yes" to confirm complete wipe');
  if (!ok) {
    console.log('Aborted.');
    return;
  }

  // Wipe data/ contents but keep the directory itself
  if (await exists(dataDir)) {
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    for (const e of entries) {
      await fs.rm(path.join(dataDir, e.name), { recursive: true, force: true });
    }
    console.log(`Wiped contents of ${dataDir} (directory kept).`);
  }

  await deleteDb(workspaceDir);
  if (await exists(dbPath)) console.log(`Deleted ${dbPath}.`);

  console.log('Done. Run wolf init to set up the workspace again (wolf.toml is intact).');
}
