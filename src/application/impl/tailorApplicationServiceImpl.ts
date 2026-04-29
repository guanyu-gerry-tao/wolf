import path from 'node:path';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { parseModelRef } from '../../utils/parseModelRef.js';
import { stripComments } from '../../utils/stripComments.js';
import { extractH2Content } from '../../utils/extractH2.js';
import type {
  TailorApplicationService,
  AnalyzeResult,
  WriteStepResult,
} from '../tailorApplicationService.js';
import type {
  TailorOptions,
  TailorResult,
  AiConfig,
  Profile,
  Job,
} from '../../utils/types/index.js';
import { log } from '../../utils/logger.js';
import { assertApiKey } from '../../utils/apiKeyGuard.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type { RenderService } from '../../service/renderService.js';
import type { ResumeCoverLetterService } from '../../service/resumeCoverLetterService.js';
import type { TailoringBriefService } from '../../service/tailoringBriefService.js';

// Self-documenting header written to every fresh hint.md. Lines starting with `>`
// are stripped before the file is shown to the analyst (same convention as
// resume_pool.md), so this preamble never reaches the AI.
const HINT_FILE_HEADER = `> [!TIP]
> hint.md - Pre-analysis guidance for the analyst agent.
>
> Write plain Markdown below this alert block to steer the analyst when it
> produces the tailoring brief for this job. Example:
>
>   Focus on the distributed systems and ML ops themes.
>   De-emphasize the architecture background.
>
> This whole alert block is stripped before the AI sees the file (see
> stripComments). Leave the file empty below to run the analyst without
> any guidance.

`;

// Bundle of resolved inputs and output paths shared across all four public methods.
// Prepared once per call so each step writes to consistent locations.
interface JobContext {
  job: Job;
  profile: Profile;
  resumePool: string;
  jdText: string;
  aiConfig: AiConfig;
  srcDir: string;
  hintPath: string;
  briefPath: string;
  resumeHtmlPath: string;
  resumePdfPath: string;
  coverLetterHtmlPath: string;
  coverLetterPdfPath: string;
}

/**
 * Default `TailorApplicationService` impl. Composes the analyst brief
 * service, the resume + cover-letter writers, and the PDF render service
 * around `JobRepository` + `ProfileRepository`. Calls `assertReadyForTailor`
 * before any AI invocation so a placeholder profile or empty pool surfaces
 * a typed error instead of a hallucinated resume.
 */
export class TailorApplicationServiceImpl implements TailorApplicationService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly profileRepository: ProfileRepository,
    private readonly renderService: RenderService,
    private readonly rewriteService: ResumeCoverLetterService,
    private readonly briefService: TailoringBriefService,
    private readonly defaultAiConfig: AiConfig,
    private readonly defaultCoverLetterTone: string,
  ) {}

  /** @inheritdoc */
  async tailor(options: TailorOptions): Promise<TailorResult> {
    // Fail fast if the user hasn't set their Anthropic key — saves a
    // confusing 401 from deep inside the SDK and gives the CLI / MCP
    // layer a typed error to present cleanly.
    assertApiKey('ANTHROPIC_API_KEY');

    // Resolve job/profile/paths once; every step below works against this context.
    const ctx = await this.prepareContext(options);

    // Make sure hint.md is in place before the analyst runs.
    await this.ensureHintFile(ctx.hintPath, options.hint);

    const writeCoverLetter = options.coverLetter !== false;
    const pipelineStartedAt = Date.now();
    log.info('tailor.pipeline.start', {
      jobId: ctx.job.id,
      profileName: ctx.profile.name,
      coverLetterIncluded: writeCoverLetter,
    });

    // Analyst first (serial) so both writers see the same brief.
    const analyzeStartedAt = Date.now();
    const brief = await this.runAnalysis(ctx);
    log.info('tailor.analyze.done', {
      jobId: ctx.job.id,
      durationMs: Date.now() - analyzeStartedAt,
    });

    // Resume + cover letter depend only on (brief + pool + jd), so they run
    // in parallel. Skip the cover letter entirely when --no-cover-letter was
    // passed — use a resolved null so the Promise.all shape stays the same.
    const coverLetterPromise = writeCoverLetter
      ? this.runCoverLetter(ctx, brief)
      : Promise.resolve(null);
    const [resumeStep, clStep] = await Promise.all([
      this.runResume(ctx, brief),
      coverLetterPromise,
    ]);

    // Pre-compute the paths we'll hand to both the DB update and the result
    // so the two sites can't drift.
    const tailoredResumePdfPath = resumeStep.pdfPath;
    const coverLetterHtmlPath = clStep?.htmlPath ?? null;
    const coverLetterPdfPath = clStep?.pdfPath ?? null;

    // Persist the generated paths on the Job row so downstream commands
    // (wolf job list, wolf fill, wolf reach) can find the artifacts.
    await this.jobRepository.update(ctx.job.id, {
      tailoredResumePdfPath,
      coverLetterHtmlPath,
      coverLetterPdfPath,
    });

    log.info('tailor.pipeline.done', {
      jobId: ctx.job.id,
      tailoredResumePdfPath,
      coverLetterPdfPath,
      durationMs: Date.now() - pipelineStartedAt,
    });

    return {
      tailoredPdfPath: tailoredResumePdfPath,
      coverLetterHtmlPath,
      coverLetterPdfPath,
      changes: [],
      matchScore: 0,
    };
  }

  /** @inheritdoc */
  async analyze(options: TailorOptions): Promise<AnalyzeResult> {
    assertApiKey('ANTHROPIC_API_KEY');
    const ctx = await this.prepareContext(options);
    await this.ensureHintFile(ctx.hintPath, options.hint);
    await this.runAnalysis(ctx);
    return { briefPath: ctx.briefPath };
  }

  /** @inheritdoc */
  async writeResume(options: TailorOptions): Promise<WriteStepResult> {
    assertApiKey('ANTHROPIC_API_KEY');
    const ctx = await this.prepareContext(options);
    const brief = await this.readBrief(ctx);
    const step = await this.runResume(ctx, brief);
    await this.jobRepository.update(ctx.job.id, { tailoredResumePdfPath: step.pdfPath });
    return step;
  }

  /** @inheritdoc */
  async writeCoverLetter(options: TailorOptions): Promise<WriteStepResult> {
    assertApiKey('ANTHROPIC_API_KEY');
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
    if (!job) {
      // Log before throwing so the failure leaves a structured breadcrumb
      // in data/logs/wolf.log.jsonl even when the caller re-raises.
      log.error('tailor.context.job_missing', { jobId });
      throw new Error(`Job not found: ${jobId}`);
    }

    // profileId here is the profile directory name (e.g. "default" or "gc-persona").
    const profile = profileId
      ? (await this.profileRepository.get(profileId)) ?? (await this.profileRepository.getDefault())
      : await this.profileRepository.getDefault();

    const resumePool = await this.profileRepository.getResumePool(profile.name);
    const jdText = await this.jobRepository.readJdText(jobId);

    // Pre-flight: refuse to run tailor on a placeholder profile or pool.
    // Otherwise the AI would faithfully build a resume from "Job Title — Company
    // Name" / blank legal name, etc. — garbage in, garbage out. Fail early with
    // a clear message so the user fills the files in before spending API tokens.
    assertReadyForTailor(profile, resumePool);

    const outputDir = await this.jobRepository.getWorkspaceDir(jobId);
    const srcDir = path.join(outputDir, 'src');
    await mkdir(srcDir, { recursive: true });

    return {
      job,
      profile,
      resumePool,
      jdText,
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

  // Reads hint.md and returns the non-comment content (stripComments removes `>`
  // blockquote lines). Returns undefined when the active portion is empty so the
  // brief service prompt stays clean.
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
      ctx.jdText,
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
      // Log before throwing — users typically see the message only once the
      // process exits, but the log file lets us debug recurring failures.
      log.error('tailor.brief.read_failed', {
        jobId: ctx.job.id,
        briefPath: ctx.briefPath,
      });
      throw new Error(
        `Tailoring brief not found at ${ctx.briefPath}. ` +
        `Run \`wolf tailor brief --job ${ctx.job.id}\` first.`,
      );
    }
  }

  private async runResume(ctx: JobContext, brief: string): Promise<WriteStepResult> {
    const html = await this.rewriteService.tailorResumeToHtml(
      ctx.resumePool,
      ctx.jdText,
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
      ctx.jdText,
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

// Minimum non-blank, non-heading lines required in resume_pool.md (after
// stripping alert blocks) before we let tailor proceed. The init template
// produces 0 such lines (each section is `## Title` followed by an empty
// `> [!TIP]` example block). 5 means "at least one bullet of one role" and
// is generous enough not to bother people who only have a sparse pool.
const MIN_POOL_CONTENT_LINES = 5;

// REQUIRED H2 fields in profile.md that tailor surfaces directly (resume
// header, cover-letter salutation). If any are blank the resume comes out
// nameless / with no contact — fail loudly here instead of producing junk.
const REQUIRED_PROFILE_FIELDS = [
  'Legal first name',
  'Legal last name',
  'Email',
  'Phone',
] as const;

/**
 * Throws a user-facing Error if the profile or pool can't safely back a
 * tailor run. The message names the file to edit so the user can act on it
 * without reading source.
 *
 * Validation is intentionally narrow:
 *   - REQUIRED_PROFILE_FIELDS in profile.md must have a non-empty body
 *   - resume_pool.md after stripComments must have ≥ MIN_POOL_CONTENT_LINES
 *     non-blank, non-heading lines (proxy for "real experience exists")
 *
 * We do NOT try to detect template-shaped content — wrapping the example
 * blocks in `> [!TIP]` already removes them at strip time, so anything that
 * survives strip is either real content or the user's intentional placeholder.
 */
function assertReadyForTailor(profile: Profile, resumePool: string): void {
  // Strip alert callouts before extraction: an H2 whose body is only a
  // `> [!IMPORTANT]` block (the un-edited template state) must count as
  // empty, not "answered".
  const strippedProfile = stripComments(profile.md);
  const missing = REQUIRED_PROFILE_FIELDS.filter(
    (field) => extractH2Content(strippedProfile, field).length === 0,
  );
  if (missing.length > 0) {
    log.error('tailor.context.profile_incomplete', {
      profileName: profile.name,
      missingFields: missing,
    });
    throw new Error(
      `Profile '${profile.name}' is missing required field(s) for tailor: ${missing.join(', ')}.\n` +
      `Open profiles/${profile.name}/profile.md and fill in the H2 sections under # Identity / # Contact.`,
    );
  }

  const stripped = stripComments(resumePool);
  const substantiveLines = stripped
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('#');
    });
  if (substantiveLines.length < MIN_POOL_CONTENT_LINES) {
    log.error('tailor.context.pool_empty', {
      profileName: profile.name,
      substantiveLines: substantiveLines.length,
      minRequired: MIN_POOL_CONTENT_LINES,
    });
    throw new Error(
      `Resume pool for profile '${profile.name}' is empty or only has placeholder examples.\n` +
      `Open profiles/${profile.name}/resume_pool.md and write at least one real experience entry ` +
      `(role + company + dates + bullets) before running tailor — otherwise the AI builds a resume from nothing.`,
    );
  }
}
