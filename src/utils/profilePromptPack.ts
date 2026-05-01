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

const PROFILE_STRATEGY_PROMPT_CONTENT: Record<ProfileStrategyPromptFile, string> = {
  'tailoring-strategy.md': `# Tailoring Strategy

Write for a new-graduate or internship candidate.

Prefer evidence from the resume pool, but do not behave like a conservative paraphraser.
You may make defensible stretch edits when a JD keyword is a natural, low-complexity extension of an existing project.

A defensible stretch must satisfy all of these conditions:
- It attaches to an existing project, role, coursework, research, internship, or open-source item.
- It could be implemented or clearly explained by the candidate before an interview.
- It does not require a major refactor, senior-level architecture, or specialized domain expertise.
- It is phrased as modest implementation work, not production-scale ownership.

Allowed examples:
- Add Redis caching, session storage, or simple rate limiting to an existing full-stack app.
- Add Dockerfile or docker-compose setup to an existing API/frontend project.
- Add GitHub Actions to run existing tests.
- Add structured logging or basic error tracking to an existing service.

Never invent:
- Employers, titles, degrees, awards, publications, or employment history.
- Large-scale metrics not present in the pool.
- Production traffic, uptime, revenue, user counts, or latency improvements not present in the pool.
- Senior ownership, tech lead scope, or expert-level domain authority.

Classify important JD keywords into three groups:

1. Direct Evidence
   The resume pool already contains clear evidence for this requirement.

2. Defensible Stretch
   The resume pool contains adjacent project evidence, and the keyword can be added as a modest, interview-defensible extension.

3. Do Not Claim
   The keyword would require inventing credentials, senior ownership, production scale, domain expertise, or facts not supported by the pool.

Use Direct Evidence first.
Use Defensible Stretch only when it materially improves match quality.
Do not route Do Not Claim items to downstream writing as claims.

For cover-letter positioning, prefer:
"Why this candidate for this role, team, or problem space?"

Do not require company naming.
If employer identity looks uncertain or conflicting, avoid specific company names.
`,

  'resume-strategy.md': `# Resume Strategy

Tailor aggressively but defensibly.

Use direct evidence first.
For direct evidence, rewrite bullets around the JD's strongest keywords.
For defensible stretch, you may add a modest implementation detail to an existing project or role.

Good stretch phrasing:
- "Added Redis caching for repeated database reads."
- "Containerized the API and frontend with Docker Compose."
- "Configured GitHub Actions to run tests on pull requests."

Bad stretch phrasing:
- "Architected a distributed Redis cluster for production traffic."
- "Led platform reliability for millions of users."
- "Reduced latency by 80%" unless the metric appears in the pool.

Keep every bullet junior-credible, implementation-level, and interview-defensible.
Do not mention or praise the employer in the resume.
Do not infer company identity from job-description prose.
`,

  'cover-letter-strategy.md': `# Cover Letter Strategy

Write a short new-graduate or internship cover letter.

Use role requirements, product context, team context, and domain context.
Do not infer the employer name from job-description prose.

Default to generic employer wording:
- "your team"
- "this role"
- "your engineering organization"
- "the product and infrastructure problems described in the role"

Only name the company if reliable canonical job metadata provides a company name and the job description does not create an obvious identity conflict.
If there is any conflict or uncertainty, avoid specific company names.

If a match is a defensible stretch, present it as adjacent project experience or a direction the candidate can extend into.
Do not present a stretch as existing production expertise.

Target 150-230 words.
Prefer 3 short paragraphs:
1. Why this role, team, or problem space fits the candidate.
2. Two or three strongest evidence-backed matches.
3. Brief closing.
`,

  'fill-strategy.md': '',
};

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

The bundled strategy files are editable starting points. Empty strategy files
are still valid and mean "use wolf's defaults".
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
    await writeIfAbsent(
      path.join(promptsDir, filename),
      PROFILE_STRATEGY_PROMPT_CONTENT[filename],
      created,
      preserved,
    );
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
