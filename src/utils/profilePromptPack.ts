import fs from 'node:fs/promises';
import path from 'node:path';

export const PROFILE_PROMPTS_DIR = 'prompts';

export const PROFILE_STRATEGY_PROMPT_FILES = [
  'tailoring-strategy.md',
  'resume-strategy.md',
  'cover-letter-strategy.md',
  'fill-strategy.md',
] as const;

export type ProfileStrategyPromptFile = typeof PROFILE_STRATEGY_PROMPT_FILES[number];

export const PROFILE_PROMPT_README = `# wolf profile prompts

This directory is for profile-specific strategy prompts.

These files are intentionally separate from wolf's built-in protocol prompts.
Protocol prompts define runtime contracts: which input sections exist, output
formats, HTML/JSON requirements, parser-facing rules, and renderer-facing rules.
Do not try to move those rules here.

You may edit the contents of the strategy files in this directory. Keep the
filenames unchanged: wolf treats the filenames as a stable contract.

Strategy files:

- tailoring-strategy.md — high-level tailoring strategy shared by analyst and writers.
- resume-strategy.md — resume writing strategy and candidate-positioning preferences.
- cover-letter-strategy.md — cover letter strategy, tone, and naming preferences.
- fill-strategy.md — application form answer strategy for future fill workflows.

Empty strategy files are valid and mean "use wolf's defaults".
`;

export interface ProfilePromptPackStatus {
  dir: string;
  files: ProfilePromptFileStatus[];
}

export interface ProfilePromptFileStatus {
  filename: 'README.md' | ProfileStrategyPromptFile;
  path: string;
  exists: boolean;
  empty: boolean;
  kind: 'readme' | 'strategy';
}

export interface ProfilePromptPackRepairResult {
  dir: string;
  created: string[];
  preserved: string[];
}

export async function ensureProfilePromptPack(profileDir: string): Promise<ProfilePromptPackRepairResult> {
  const promptsDir = path.join(profileDir, PROFILE_PROMPTS_DIR);
  await fs.mkdir(promptsDir, { recursive: true });

  const created: string[] = [];
  const preserved: string[] = [];

  await writeIfAbsent(path.join(promptsDir, 'README.md'), PROFILE_PROMPT_README, created, preserved);
  for (const filename of PROFILE_STRATEGY_PROMPT_FILES) {
    await writeIfAbsent(path.join(promptsDir, filename), '', created, preserved);
  }

  return { dir: promptsDir, created, preserved };
}

export async function getProfilePromptPackStatus(profileDir: string): Promise<ProfilePromptPackStatus> {
  const promptsDir = path.join(profileDir, PROFILE_PROMPTS_DIR);
  const files: ProfilePromptFileStatus[] = [];

  files.push(await getPromptFileStatus(promptsDir, 'README.md', 'readme'));
  for (const filename of PROFILE_STRATEGY_PROMPT_FILES) {
    files.push(await getPromptFileStatus(promptsDir, filename, 'strategy'));
  }

  return { dir: promptsDir, files };
}

async function getPromptFileStatus(
  promptsDir: string,
  filename: 'README.md' | ProfileStrategyPromptFile,
  kind: 'readme' | 'strategy',
): Promise<ProfilePromptFileStatus> {
  const filePath = path.join(promptsDir, filename);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      filename,
      path: filePath,
      exists: true,
      empty: content.trim().length === 0,
      kind,
    };
  } catch {
    return {
      filename,
      path: filePath,
      exists: false,
      empty: true,
      kind,
    };
  }
}

async function writeIfAbsent(
  filePath: string,
  content: string,
  created: string[],
  preserved: string[],
): Promise<void> {
  const exists = await fs.access(filePath).then(() => true).catch(() => false);
  if (exists) {
    preserved.push(filePath);
    return;
  }
  await fs.writeFile(filePath, content, 'utf-8');
  created.push(filePath);
}
