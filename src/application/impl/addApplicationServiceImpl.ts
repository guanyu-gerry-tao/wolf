import { randomUUID } from 'node:crypto';
import type { AddApplicationService } from '../addApplicationService.js';
import type { AddOptions, AddResult } from '../../utils/types/index.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { CompanyRepository } from '../../repository/companyRepository.js';

/**
 * SQLite-backed `AddApplicationService`. Looks up the company by name through
 * `CompanyRepository`, creates one when missing, then writes the job row +
 * JD prose via `JobRepository`.
 */
export class AddApplicationServiceImpl implements AddApplicationService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly companyRepository: CompanyRepository,
  ) {}

  /** @inheritdoc */
  async add(options: AddOptions): Promise<AddResult> {
    const now = new Date().toISOString();

    // Reuse existing company row by name; otherwise create one.
    let company = await this.companyRepository.getByName(options.company);
    if (!company) {
      company = {
        id: randomUUID(),
        name: options.company,
        domain: null,
        linkedinUrl: null,
        size: null,
        industry: null,
        headquartersLocation: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };
      await this.companyRepository.upsert(company);
    }

    const jobId = randomUUID();
    await this.jobRepository.save({
      id: jobId,
      title: options.title,
      companyId: company.id,
      url: options.url ?? '',
      source: 'Other',
      location: '',
      remote: false,
      salary: null,
      workAuthorizationRequired: 'no sponsorship',
      clearanceRequired: false,
      score: null,
      scoreJustification: null,
      status: 'new',
      error: null,
      appliedProfileId: null,
      tailoredResumePdfPath: null,
      coverLetterHtmlPath: null,
      coverLetterPdfPath: null,
      screenshotPath: null,
      outreachDraftPath: null,
      createdAt: now,
      updatedAt: now,
    });

    // JD text lives on disk (grep-friendly prose), not in SQLite.
    await this.jobRepository.writeJdText(jobId, options.jdText);

    return { jobId };
  }
}
