import fs from 'node:fs/promises';
import type { JobRepository } from '../../repository/jobRepository.js';
import type {
  ArtifactApplicationService,
  CompanionArtifactFile,
  CompanionArtifactKind,
  CompanionArtifactReadiness,
  CompanionArtifactSlot,
} from '../artifactApplicationService.js';

export class ArtifactApplicationServiceImpl implements ArtifactApplicationService {
  constructor(private readonly jobRepository: JobRepository) {}

  /** @inheritdoc */
  async getReadiness(jobId: string, baseUrl: string): Promise<CompanionArtifactReadiness> {
    const job = await this.jobRepository.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    return {
      jobId,
      resume: await this.slot(job.hasTailoredResume, jobId, 'resume', baseUrl),
      coverLetter: await this.slot(job.hasTailoredCoverLetter, jobId, 'cover-letter', baseUrl),
    };
  }

  /** @inheritdoc */
  async getPreviewFile(jobId: string, kind: CompanionArtifactKind): Promise<CompanionArtifactFile> {
    const path = await this.artifactPath(jobId, kind);
    await fs.access(path);
    return {
      path,
      contentType: path.endsWith('.pdf') ? 'application/pdf' : 'text/html; charset=utf-8',
    };
  }

  private async slot(
    produced: boolean,
    jobId: string,
    kind: CompanionArtifactKind,
    baseUrl: string,
  ): Promise<CompanionArtifactSlot> {
    if (!produced) return { status: 'not_ready', url: null };
    const path = await this.artifactPath(jobId, kind);
    const exists = await fs.access(path).then(() => true).catch(() => false);
    return exists
      ? { status: 'ready', url: null }
      : { status: 'not_ready', url: null };
  }

  private artifactPath(jobId: string, kind: CompanionArtifactKind): Promise<string> {
    return this.jobRepository.getArtifactPath(
      jobId,
      kind === 'resume' ? 'resume_pdf' : 'cover_letter_pdf',
    );
  }
}
