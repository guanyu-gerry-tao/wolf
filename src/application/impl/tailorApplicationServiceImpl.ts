import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import type { TailorApplicationService } from '../tailorApplicationService.js';
import type { TailorOptions, TailorResult, AiConfig } from '../../types/index.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type { RenderService } from '../../service/renderService.js';
import type { ResumeCoverLetterService } from '../../service/resumeCoverLetterService.js';

// Strip characters unsafe for directory names, collapse repeated underscores, cap length.
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_').slice(0, 40);
}

export class TailorApplicationServiceImpl implements TailorApplicationService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly profileRepository: ProfileRepository,
    private readonly renderService: RenderService,
    private readonly rewriteService: ResumeCoverLetterService,
    private readonly workspaceDir: string,
    private readonly defaultAiConfig: AiConfig,
    private readonly defaultCoverLetterTone: string,
  ) {}

  async tailor(options: TailorOptions): Promise<TailorResult> {
    const { jobId, profileId } = options;

    // Merge defaults with per-command overrides.
    const aiConfig: AiConfig = {
      provider: options.aiProvider ?? this.defaultAiConfig.provider,
      model: options.aiModel ?? this.defaultAiConfig.model,
    };

    const job = await this.jobRepository.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    // Fall back to default profile if no profileId specified.
    const profile = profileId
      ? await this.profileRepository.get(profileId) ?? await this.profileRepository.getDefault()
      : await this.profileRepository.getDefault();

    const resumePool = await this.profileRepository.getResumePool(profile.id);

    // Create output directory: data/<company>_<title>_<jobId>/
    const dirName = `${sanitize(job.companyId)}_${sanitize(job.title)}_${jobId}`;
    const outputDir = path.join(this.workspaceDir, 'data', dirName);
    await mkdir(outputDir, { recursive: true });

    // --- Resume ---
    // Rewrite resume pool into tailored HTML body matching this JD, then render to PDF.
    const htmlBody = await this.rewriteService.tailorResumeToHtml(
      resumePool,
      job.description,
      profile,
      aiConfig,
    );
    const pdfBuffer = await this.renderService.renderPdf(htmlBody);
    const pdfPath = path.join(outputDir, 'resume.pdf');
    await writeFile(pdfPath, pdfBuffer);

    // --- Cover Letter (default: true) ---
    let coverLetterHtmlPath: string | null = null;
    let coverLetterPdfPath: string | null = null;

    if (options.coverLetter !== false) {
      // Generate cover letter HTML and render to PDF using the same Playwright pipeline.
      const clHtml = await this.rewriteService.generateCoverLetter(
        resumePool,
        job.description,
        profile,
        this.defaultCoverLetterTone,
        aiConfig,
      );
      coverLetterHtmlPath = path.join(outputDir, 'cover_letter.html');
      await writeFile(coverLetterHtmlPath, clHtml);
      const clPdfBuffer = await this.renderService.renderPdf(clHtml);
      coverLetterPdfPath = path.join(outputDir, 'cover_letter.pdf');
      await writeFile(coverLetterPdfPath, clPdfBuffer);
    }

    await this.jobRepository.update(jobId, {
      tailoredResumePdfPath: pdfPath,
      coverLetterHtmlPath,
      coverLetterPdfPath,
    });

    return {
      tailoredTexPath: null,
      tailoredPdfPath: pdfPath,
      coverLetterHtmlPath,
      coverLetterPdfPath,
      changes: [],
      matchScore: 0,
    };
  }
}
