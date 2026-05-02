import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { ProfileRepository } from '../../repository/profileRepository.js';
import type { StagehandFillService } from '../../service/stagehandFillService.js';
import type { TailorApplicationService } from '../tailorApplicationService.js';
import type {
  BatchTailorInput,
  CompanionActionApplicationService,
  CompanionActionStartResult,
  QuickFillInput,
  QuickTailorInput,
  RegenerateArtifactInput,
} from '../companionActionApplicationService.js';
import type { RunStatusResult } from '../runStatusApplicationService.js';

type LocalRun = RunStatusResult;

export class CompanionActionApplicationServiceImpl implements CompanionActionApplicationService {
  private readonly runs = new Map<string, LocalRun>();

  constructor(
    private readonly tailorApplicationService: TailorApplicationService,
    private readonly jobRepository: JobRepository,
    private readonly profileRepository: ProfileRepository,
    private readonly stagehandFillService?: StagehandFillService,
  ) {}

  /** @inheritdoc */
  async quickTailor(input: QuickTailorInput): Promise<CompanionActionStartResult> {
    const runId = `quick_tailor_${randomUUID()}`;
    this.setRun({ runId, status: 'queued', type: 'tailor', itemCount: 1 });
    void this.runTailor(runId, [input.jobId], input.userPrompt, input.artifactTargets);
    return { runId, status: 'queued' };
  }

  /** @inheritdoc */
  async batchTailor(input: BatchTailorInput): Promise<CompanionActionStartResult> {
    const jobIds = input.jobIds?.length ? input.jobIds : await this.defaultBatchJobIds(input.statusFilter);
    const runId = `batch_tailor_${randomUUID()}`;
    this.setRun({ runId, status: 'queued', type: 'tailor', itemCount: jobIds.length });
    void this.runTailor(runId, jobIds, input.userPrompt, ['resume', 'cover_letter']);
    return { runId, status: 'queued' };
  }

  /** @inheritdoc */
  async regenerateArtifact(input: RegenerateArtifactInput): Promise<CompanionActionStartResult> {
    const runId = `regenerate_${randomUUID()}`;
    this.setRun({
      runId,
      status: 'queued',
      type: input.artifactType === 'resume' ? 'regenerate_resume' : 'regenerate_cover_letter',
      itemCount: 1,
    });
    void this.runRegenerateArtifact(runId, input);
    return { runId, status: 'queued' };
  }

  /** @inheritdoc */
  async quickFill(input: QuickFillInput): Promise<CompanionActionStartResult> {
    const runId = `quick_fill_${randomUUID()}`;
    this.setRun({ runId, status: 'queued', type: 'fill', itemCount: 1 });
    void this.runSafeAutofill(runId, input);
    return { runId, status: 'queued' };
  }

  /** @inheritdoc */
  async getRunStatus(runId: string): Promise<RunStatusResult | null> {
    return this.runs.get(runId) ?? null;
  }

  private async runTailor(
    runId: string,
    jobIds: string[],
    userPrompt: string | undefined,
    artifactTargets: ('resume' | 'cover_letter')[],
  ): Promise<void> {
    this.patchRun(runId, { status: 'running' });
    try {
      for (const jobId of jobIds) {
        await this.tailorApplicationService.tailor({
          jobId,
          hint: userPrompt,
          coverLetter: artifactTargets.includes('cover_letter'),
        });
      }
      this.patchRun(runId, {
        status: 'ready',
        artifacts: {
          resume: { status: artifactTargets.includes('resume') ? 'ready' : 'not_ready', url: null },
          coverLetter: { status: artifactTargets.includes('cover_letter') ? 'ready' : 'not_ready', url: null },
        },
      });
    } catch (err) {
      this.patchRun(runId, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async runRegenerateArtifact(runId: string, input: RegenerateArtifactInput): Promise<void> {
    this.patchRun(runId, { status: 'running' });
    try {
      const existingArtifactText = await this.existingArtifactText(input);
      const hint = buildRegenerateHint(input.artifactType, existingArtifactText, input.userPrompt);
      await this.tailorApplicationService.analyze({ jobId: input.jobId, hint });
      if (input.artifactType === 'resume') {
        await this.tailorApplicationService.writeResume({ jobId: input.jobId });
      } else {
        await this.tailorApplicationService.writeCoverLetter({ jobId: input.jobId });
      }
      this.patchRun(runId, {
        status: 'ready',
        artifacts: {
          resume: { status: input.artifactType === 'resume' ? 'ready' : 'not_ready', url: null },
          coverLetter: { status: input.artifactType === 'cover_letter' ? 'ready' : 'not_ready', url: null },
        },
      });
    } catch (err) {
      this.patchRun(runId, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async existingArtifactText(input: RegenerateArtifactInput): Promise<string> {
    const supplied = input.existingArtifactText.trim();
    const pathOnDisk = await this.existingArtifactPath(input.jobId, input.artifactType);
    const diskText = pathOnDisk
      ? await readFile(pathOnDisk, 'utf-8').catch(() => '')
      : '';
    return [supplied, diskText].filter((part) => part.trim().length > 0).join('\n\n--- existing file on disk ---\n\n');
  }

  private async existingArtifactPath(jobId: string, artifactType: RegenerateArtifactInput['artifactType']): Promise<string | null> {
    if (artifactType === 'cover_letter') {
      return this.jobRepository.getArtifactPath(jobId, 'cover_letter_html');
    }
    const workspaceDir = await this.jobRepository.getWorkspaceDir(jobId);
    return path.join(workspaceDir, 'src', 'resume.html');
  }

  private async runSafeAutofill(runId: string, input: QuickFillInput): Promise<void> {
    this.patchRun(runId, { status: 'running' });
    try {
      if (!input.page) throw new Error('Wolf browser page is not available.');
      // TODO(companion-stagehand): Replace this conservative DOM filler with
      // Stagehand LOCAL observe/cache/replay. The temporary path only fills
      // obvious profile/contact fields and never clicks submit, so it stays
      // safe while the Stagehand selector cache is still being designed.
      const profile = await this.profileRepository.getDefault();
      const fillValues = extractBasicFillValues(profile.md);
      const stagehandResult = await this.stagehandFillService?.fill({
        page: input.page,
        jobId: input.jobId,
        userPrompt: input.userPrompt,
        profileMarkdown: profile.md,
        fillValues,
      });
      if (stagehandResult?.mode === 'stagehand') {
        await this.jobRepository.update(input.jobId, { hasScreenshots: true });
        this.patchRun(runId, { status: 'ready', type: 'fill', itemCount: 1 });
        return;
      }
      await fillKnownFields(input.page, fillValues);
      await this.jobRepository.update(input.jobId, { hasScreenshots: true });
      this.patchRun(runId, { status: 'ready', type: 'fill', itemCount: 1 });
    } catch (err) {
      this.patchRun(runId, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async defaultBatchJobIds(statusFilter: string | undefined): Promise<string[]> {
    const jobs = await this.jobRepository.query({
      status: statusFilter === 'reviewed' ? 'reviewed' : undefined,
      limit: 20,
    });
    return jobs.map((job) => job.id);
  }

  private setRun(run: LocalRun): void {
    this.runs.set(run.runId, run);
  }

  private patchRun(runId: string, patch: Partial<LocalRun>): void {
    const existing = this.runs.get(runId);
    if (!existing) return;
    this.runs.set(runId, { ...existing, ...patch });
  }
}

function buildRegenerateHint(
  artifactType: RegenerateArtifactInput['artifactType'],
  existingArtifactText: string,
  userPrompt: string,
): string {
  const artifactLabel = artifactType === 'resume' ? 'resume' : 'cover letter';
  return [
    `Regenerate only the ${artifactLabel} for this job.`,
    'This is a one-shot edit request from wolf companion. Do not assume memory from previous edits.',
    'Apply all user instructions below while still following the job description and candidate profile.',
    `## User edit instructions\n${userPrompt}`,
    existingArtifactText.trim()
      ? `## Existing ${artifactLabel} text/html\n${existingArtifactText}`
      : `## Existing ${artifactLabel} text/html\nNo existing artifact text was available. Regenerate from the current job and profile context.`,
  ].join('\n\n');
}

function extractBasicFillValues(profileMd: string): Record<string, string> {
  const values: Record<string, string> = {};
  const lines = profileMd.split('\n');
  for (const line of lines) {
    const match = line.match(/^[-*]?\s*([^:]+):\s*(.+)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key.includes('email')) values.email = value;
    if (key.includes('phone')) values.phone = value;
    if (key.includes('legal first') || key === 'first name') values.firstName = value;
    if (key.includes('legal last') || key === 'last name') values.lastName = value;
    if (key === 'name' || key.includes('preferred name')) values.name = value;
    if (key.includes('linkedin')) values.linkedin = value;
    if (key.includes('github')) values.github = value;
    if (key.includes('website')) values.website = value;
  }
  return values;
}

async function fillKnownFields(page: Page, values: Record<string, string>): Promise<void> {
  await page.evaluate((fillValues) => {
    function fieldLabel(input: HTMLInputElement): string {
      const bits = [
        input.name,
        input.id,
        input.getAttribute('autocomplete'),
        input.getAttribute('aria-label'),
        input.placeholder,
      ];
      const labels = input.id ? [...document.querySelectorAll(`label[for="${CSS.escape(input.id)}"]`)] : [];
      for (const label of labels) bits.push(label.textContent ?? '');
      return bits.filter(Boolean).join(' ').toLowerCase();
    }

    function valueForLabel(label: string, available: Record<string, string>): string | undefined {
      if (label.includes('email')) return available.email;
      if (label.includes('phone') || label.includes('mobile')) return available.phone;
      if (label.includes('first')) return available.firstName ?? available.name;
      if (label.includes('last')) return available.lastName;
      if (label.includes('linkedin')) return available.linkedin;
      if (label.includes('github')) return available.github;
      if (label.includes('website') || label.includes('portfolio')) return available.website;
      if (label.includes('name')) return available.name;
      return undefined;
    }

    const inputs = [...document.querySelectorAll('input, textarea')] as HTMLInputElement[];
    for (const input of inputs) {
      const label = fieldLabel(input);
      const value = valueForLabel(label, fillValues);
      if (!value || input.type === 'file' || input.type === 'submit' || input.type === 'button') continue;
      input.focus();
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, values);
}
