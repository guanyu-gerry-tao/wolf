import path from 'node:path';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { parseModelRef } from '../../utils/parseModelRef.js';
import { stripComments } from '../../utils/stripComments.js';
import type {
  TailorApplicationService,
  AnalyzeResult,
  WriteStepResult,
} from '../tailorApplicationService.js';
import type {
  TailorOptions,
  TailorResult,
  AiConfig,
  UserProfile,
  Job,
} from '../../types/index.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type { RenderService } from '../../service/renderService.js';
import type { ResumeCoverLetterService } from '../../service/resumeCoverLetterService.js';
import type { TailoringBriefService } from '../../service/tailoringBriefService.js';

// Strip characters unsafe for directory names, collapse repeated underscores, cap length.
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_').slice(0, 40);
}

// Self-documenting header written to every fresh hint.md. Lines starting with //
// are stripped before the file is shown to the analyst (same convention as
// resume_pool.md), so this preamble never reaches the AI.
const HINT_FILE_HEADER = `// hint.md - Pre-analysis guidance for the analyst agent.
//
// Write plain Markdown below these comments to steer the analyst when it
// produces the tailoring brief for this job. Example:
//
//   Focus on the distributed systems and ML ops themes.
//   De-emphasize the architecture background.
//
// Lines starting with // (like this one) are comments that get stripped
// before the analyst sees the file. Leave this file empty below the
// comments and the analyst will run without any guidance.

`;

// Bundle of resolved inputs and output paths shared across all four public methods.
// Prepared once per call so each step writes to consistent locations.
interface JobContext {
  job: Job;
  profile: UserProfile;
  resumePool: string;
  aiConfig: AiConfig;
  srcDir: string;
  hintPath: string;
  briefPath: string;
  resumeHtmlPath: string;
  resumePdfPath: string;
  coverLetterHtmlPath: string;
  coverLetterPdfPath: string;
}

export class TailorApplicationServiceImpl implements TailorApplicationService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly profileRepository: ProfileRepository,
    private readonly renderService: RenderService,
    private readonly rewriteService: ResumeCoverLetterService,
    private readonly briefService: TailoringBriefService,
    private readonly workspaceDir: string,
    private readonly defaultAiConfig: AiConfig,
    private readonly defaultCoverLetterTone: string,
  ) {}

  async tailor(options: TailorOptions): Promise<TailorResult> {
    const ctx = await this.prepareContext(options);
    await this.ensureHintFile(ctx.hintPath, options.hint);

    // Analyst first (serial) so both writers see the same brief.
    const brief = await this.runAnalysis(ctx);

    // Resume + CL depend only on (brief + pool + jd), so they run in parallel.
    // Skip the CL step if the caller passed --no-cover-letter.
    const writeCoverLetter = options.coverLetter !== false;
    const [resumeStep, clStep] = await Promise.all([
      this.runResume(ctx, brief),
      writeCoverLetter ? this.runCoverLetter(ctx, brief) : Promise.resolve(null),
    ]);

    await this.jobRepository.update(ctx.job.id, {
      tailoredResumePdfPath: resumeStep.pdfPath,
      coverLetterHtmlPath: clStep?.htmlPath ?? null,
      coverLetterPdfPath:  clStep?.pdfPath  ?? null,
    });

    return {
      tailoredPdfPath: resumeStep.pdfPath,
      coverLetterHtmlPath: clStep?.htmlPath ?? null,
      coverLetterPdfPath:  clStep?.pdfPath  ?? null,
      changes: [],
      matchScore: 0,
    };
  }

  async analyze(options: TailorOptions): Promise<AnalyzeResult> {
    const ctx = await this.prepareContext(options);
    await this.ensureHintFile(ctx.hintPath, options.hint);
    await this.runAnalysis(ctx);
    return { briefPath: ctx.briefPath };
  }

  async writeResume(options: TailorOptions): Promise<WriteStepResult> {
    const ctx = await this.prepareContext(options);
    const brief = await this.readBrief(ctx);
    const step = await this.runResume(ctx, brief);
    await this.jobRepository.update(ctx.job.id, { tailoredResumePdfPath: step.pdfPath });
    return step;
  }

  async writeCoverLetter(options: TailorOptions): Promise<WriteStepResult> {
    const ctx = await this.prepareContext(options);
    const brief = await this.readBrief(ctx);
    const step = await this.runCoverLetter(ctx, brief);
    await this.jobRepository.update(ctx.job.id, {
      coverLetterHtmlPath: step.htmlPath,
      coverLetterPdfPath:  step.pdfPath,
    });
    return step;
  }

  // ---- private helpers ----

  private async prepareContext(options: TailorOptions): Promise<JobContext> {
    const { jobId, profileId } = options;

    const aiConfig: AiConfig = options.aiModel
      ? parseModelRef(options.aiModel)
      : this.defaultAiConfig;

    const job = await this.jobRepository.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const profile = profileId
      ? (await this.profileRepository.get(profileId)) ?? (await this.profileRepository.getDefault())
      : await this.profileRepository.getDefault();

    const resumePool = await this.profileRepository.getResumePool(profile.id);

    const dirName = `${sanitize(job.companyId)}_${sanitize(job.title)}_${jobId}`;
    const outputDir = path.join(this.workspaceDir, 'data', dirName);
    const srcDir = path.join(outputDir, 'src');
    await mkdir(srcDir, { recursive: true });

    return {
      job,
      profile,
      resumePool,
      aiConfig,
      srcDir,
      hintPath:             path.join(srcDir, 'hint.md'),
      briefPath:            path.join(srcDir, 'tailoring-brief.md'),
      resumeHtmlPath:       path.join(srcDir, 'resume.html'),
      resumePdfPath:        path.join(outputDir, 'resume.pdf'),
      coverLetterHtmlPath:  path.join(srcDir, 'cover_letter.html'),
      coverLetterPdfPath:   path.join(outputDir, 'cover_letter.pdf'),
    };
  }

  // hint.md policy:
  //   - Always exists. On first run we write the self-documenting header only.
  //   - When --hint is passed, the caller-supplied text goes after the header
  //     (replacing any previous content below the header).
  //   - When no --hint is passed, we leave existing content untouched (so a
  //     hint from a previous run still takes effect) but make sure the file
  //     exists with at least the header.
  private async ensureHintFile(hintPath: string, newHint?: string): Promise<void> {
    if (newHint !== undefined) {
      await writeFile(hintPath, HINT_FILE_HEADER + newHint.trim() + '\n', 'utf-8');
      return;
    }
    const exists = await access(hintPath).then(() => true).catch(() => false);
    if (!exists) {
      await writeFile(hintPath, HINT_FILE_HEADER, 'utf-8');
    }
  }

  // Reads hint.md and returns the non-comment content (stripComments removes //
  // lines). Returns undefined when the active portion is empty so the brief
  // service prompt stays clean.
  private async readActiveHint(hintPath: string): Promise<string | undefined> {
    let raw: string;
    try { raw = await readFile(hintPath, 'utf-8'); }
    catch { return undefined; }
    const active = stripComments(raw).trim();
    return active.length > 0 ? active : undefined;
  }

  private async runAnalysis(ctx: JobContext): Promise<string> {
    const hint = await this.readActiveHint(ctx.hintPath);
    const brief = await this.briefService.analyze(
      ctx.resumePool,
      ctx.job.description,
      ctx.profile,
      ctx.aiConfig,
      hint,
    );
    await writeFile(ctx.briefPath, brief);
    return brief;
  }

  private async readBrief(ctx: JobContext): Promise<string> {
    try {
      return await readFile(ctx.briefPath, 'utf-8');
    } catch {
      throw new Error(
        `Tailoring brief not found at ${ctx.briefPath}. ` +
        `Run \`wolf tailor brief --job ${ctx.job.id}\` first.`,
      );
    }
  }

  private async runResume(ctx: JobContext, brief: string): Promise<WriteStepResult> {
    const html = await this.rewriteService.tailorResumeToHtml(
      ctx.resumePool,
      ctx.job.description,
      ctx.profile,
      brief,
      ctx.aiConfig,
    );
    await writeFile(ctx.resumeHtmlPath, html);
    const pdf = await this.renderService.renderPdf(html);
    await writeFile(ctx.resumePdfPath, pdf);
    return { htmlPath: ctx.resumeHtmlPath, pdfPath: ctx.resumePdfPath };
  }

  private async runCoverLetter(ctx: JobContext, brief: string): Promise<WriteStepResult> {
    const html = await this.rewriteService.generateCoverLetter(
      ctx.resumePool,
      ctx.job.description,
      ctx.profile,
      brief,
      this.defaultCoverLetterTone,
      ctx.aiConfig,
    );
    await writeFile(ctx.coverLetterHtmlPath, html);
    const pdf = await this.renderService.renderCoverLetterPdf(html);
    await writeFile(ctx.coverLetterPdfPath, pdf);
    return { htmlPath: ctx.coverLetterHtmlPath, pdfPath: ctx.coverLetterPdfPath };
  }
}
