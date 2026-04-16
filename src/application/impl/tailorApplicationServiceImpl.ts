import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseModelRef } from '../../utils/parseModelRef.js';
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

    // Merge defaults with per-command override.
    const aiConfig: AiConfig = options.aiModel
      ? parseModelRef(options.aiModel)
      : this.defaultAiConfig;

    const job = await this.jobRepository.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    // Fall back to default profile if no profileId specified.
    const profile = profileId
      ? await this.profileRepository.get(profileId) ?? await this.profileRepository.getDefault()
      : await this.profileRepository.getDefault();

    const resumePool = await this.profileRepository.getResumePool(profile.id);

    // Create output directories:
    //   data/<company>_<title>_<jobId>/         — PDFs (final output)
    //   data/<company>_<title>_<jobId>/src/     — HTML source (for prompt inspection)
    const dirName = `${sanitize(job.companyId)}_${sanitize(job.title)}_${jobId}`;
    const outputDir = path.join(this.workspaceDir, 'data', dirName);
    const srcDir = path.join(outputDir, 'src');
    await mkdir(srcDir, { recursive: true });

    // --- Resume ---
    // Rewrite resume pool into tailored HTML body matching this JD, then render to PDF.
    const htmlBody = await this.rewriteService.tailorResumeToHtml(
      resumePool,
      job.description,
      profile,
      aiConfig,
    );
    // Save HTML source for inspection alongside the PDF.
    await writeFile(path.join(srcDir, 'resume.html'), htmlBody);
    const pdfBuffer = await this.renderService.renderPdf(htmlBody);
    const pdfPath = path.join(outputDir, 'resume.pdf');
    await writeFile(pdfPath, pdfBuffer);

    // --- Cover Letter (default: true) ---
    let coverLetterHtmlPath: string | null = null;
    let coverLetterPdfPath: string | null = null;

    if (options.coverLetter !== false) {
      const clHtml = await this.rewriteService.generateCoverLetter(
        resumePool,
        job.description,
        profile,
        this.defaultCoverLetterTone,
        aiConfig,
      );
      // Save HTML source for inspection.
      coverLetterHtmlPath = path.join(srcDir, 'cover_letter.html');
      await writeFile(coverLetterHtmlPath, clHtml);
      // Render to PDF using simple renderer (no fit algorithm — cover letters don't need forced one-page)
      const clPdfBuffer = await this.renderService.renderCoverLetterPdf(clHtml);
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
