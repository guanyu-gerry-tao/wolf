import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import type { TailorApplicationService } from '../tailor.js';
import type { TailorResult } from '../../types/index.js';
import type { JobRepository } from '../../repository/job.js';
import type { ProfileRepository } from '../../repository/profile.js';
import type { RenderService } from '../../service/render.js';
import type { RewriteService } from '../../service/rewrite.js';

// Strip characters unsafe for directory names, collapse repeated underscores, cap length.
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_').slice(0, 40);
}

export class TailorApplicationServiceImpl implements TailorApplicationService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly profileRepository: ProfileRepository,
    private readonly renderService: RenderService,
    private readonly rewriteService: RewriteService,
    private readonly workspaceDir: string,
  ) {}

  async tailor(jobId: string, profileId?: string): Promise<TailorResult> {
    const job = await this.jobRepository.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    // Fall back to default profile if no profileId specified.
    const profile = profileId
      ? await this.profileRepository.get(profileId) ?? await this.profileRepository.getDefault()
      : await this.profileRepository.getDefault();

    const resumePool = await this.profileRepository.getResumePool(profile.id);

    // Rewrite resume pool into tailored HTML body matching this JD.
    const htmlBody = await this.rewriteService.tailorResumeToHtml(
      resumePool,
      job.description,
      profile,
    );

    // Render HTML body to one-page PDF.
    const pdfBuffer = await this.renderService.renderResumePdf(htmlBody);

    // Write PDF to data/<company>_<title>_<jobId>/resume.pdf
    const dirName = `${sanitize(job.companyId)}_${sanitize(job.title)}_${jobId}`;
    const outputDir = path.join(this.workspaceDir, 'data', dirName);
    await mkdir(outputDir, { recursive: true });
    const pdfPath = path.join(outputDir, 'resume.pdf');
    await writeFile(pdfPath, pdfBuffer);

    await this.jobRepository.update(jobId, {
      tailoredResumePdfPath: pdfPath,
    });

    return {
      tailoredTexPath: null,
      tailoredPdfPath: pdfPath,
      coverLetterMdPath: null,
      coverLetterPdfPath: null,
      changes: [],
      matchScore: 0,
    };
  }
}
