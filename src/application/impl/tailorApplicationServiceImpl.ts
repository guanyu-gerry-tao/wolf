import path from 'node:path';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { parseModelRef } from '../../utils/parseModelRef.js';
import { stripComments } from '../../utils/stripComments.js';
import { isFilled, getByPath, type ProfileToml } from '../../utils/profileToml.js';
import { REQUIRED_PROFILE_FIELDS } from '../../utils/profileFields.js';
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
import { currentBinaryName } from '../../utils/instance.js';
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

    // β.10h: artifact paths are convention-derived (see JobRepository.
    // getArtifactPath). We persist booleans on the Job row to mark which
    // pipeline steps have produced their outputs; the return value still
    // carries the actual paths so the CLI can echo them.
    const tailoredResumePdfPath = resumeStep.pdfPath;
    const coverLetterHtmlPath = clStep?.htmlPath ?? null;
    const coverLetterPdfPath = clStep?.pdfPath ?? null;

    await this.jobRepository.update(ctx.job.id, {
      hasTailoredResume: true,
      hasTailoredCoverLetter: clStep !== null,
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
    // β.10h: paths are convention-derived; persist a boolean flag instead.
    await this.jobRepository.update(ctx.job.id, { hasTailoredResume: true });
    return step;
  }

  /** @inheritdoc */
  async writeCoverLetter(options: TailorOptions): Promise<WriteStepResult> {
    assertApiKey('ANTHROPIC_API_KEY');
    const ctx = await this.prepareContext(options);
    const brief = await this.readBrief(ctx);
    const step = await this.runCoverLetter(ctx, brief);
    // β.10h: paths are convention-derived; persist a single boolean flag.
    await this.jobRepository.update(ctx.job.id, { hasTailoredCoverLetter: true });
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
    // a clear message so the user fills the file in before spending API tokens.
    const tomlProfile = await this.profileRepository.getProfileToml(profile.name);
    assertReadyForTailor(profile, tomlProfile);

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
        `Run \`${currentBinaryName()} tailor brief --job ${ctx.job.id}\` first.`,
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

// Minimum total resume entries (experience / project / education / filled
// skill buckets) before tailor accepts a workspace. 5 = "at least one role
// with bullets, plus a couple of skill groups" — generous enough not to
// bother people with sparse pools but loud enough that tailor never sees
// a totally empty profile and produces a nameless resume.
const MIN_RESUME_ENTRIES = 5;

/**
 * Throws a user-facing Error if the profile can't safely back a tailor run.
 * Pulls REQUIRED-field metadata from `PROFILE_FIELDS` (single source of
 * truth shared with `wolf doctor` / `wolf profile fields`).
 *
 * Validation is intentionally narrow:
 *   - REQUIRED fields in `PROFILE_FIELDS` must be filled (per `isFilled`).
 *   - Resume content (experience / project / education / skills) must
 *     produce ≥ `MIN_RESUME_ENTRIES` filled entries.
 */
function assertReadyForTailor(profile: Profile, toml: ProfileToml): void {
  const missing: string[] = [];
  for (const field of REQUIRED_PROFILE_FIELDS) {
    const value = getByPath(toml, field.path);
    const filled = typeof value === 'string' ? isFilled(value) : value !== undefined;
    if (!filled) missing.push(field.path);
  }
  if (missing.length > 0) {
    log.error('tailor.context.profile_incomplete', {
      profileName: profile.name,
      missingFields: missing,
    });
    throw new Error(
      `Profile '${profile.name}' is missing required field(s) for tailor: ${missing.join(', ')}.\n` +
      `Run \`wolf profile set <field> <value>\` for each missing field, or \`wolf doctor\` to see help text.`,
    );
  }

  let entryCount = 0;
  for (const e of toml.experience) {
    if (isFilled(e.job_title) || isFilled(e.bullets)) entryCount++;
  }
  for (const p of toml.project) {
    if (isFilled(p.name) || isFilled(p.bullets)) entryCount++;
  }
  for (const e of toml.education) {
    if (isFilled(e.degree) || isFilled(e.school)) entryCount++;
  }
  if (isFilled(toml.skills.languages))  entryCount++;
  if (isFilled(toml.skills.frameworks)) entryCount++;
  if (isFilled(toml.skills.tools))      entryCount++;
  if (isFilled(toml.skills.domains))    entryCount++;
  if (isFilled(toml.skills.free_text))  entryCount++;
  if (entryCount < MIN_RESUME_ENTRIES) {
    log.error('tailor.context.pool_empty', {
      profileName: profile.name,
      entryCount,
      minRequired: MIN_RESUME_ENTRIES,
    });
    throw new Error(
      `Resume content for profile '${profile.name}' is too sparse (only ${entryCount} entries; need ≥ ${MIN_RESUME_ENTRIES}).\n` +
      `Add experience / project / education entries via \`wolf profile add <type>\` ` +
      `and skills via \`wolf profile set skills.<bucket> <value>\` before running tailor.`,
    );
  }
}
