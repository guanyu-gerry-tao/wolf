import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BackgroundAiBatchStatus } from '../../repository/backgroundAiBatchRepository.js';
import type { BackgroundAiBatchRepository } from '../../repository/backgroundAiBatchRepository.js';
import type { BatchItem, BatchItemRepository } from '../../repository/batchItemRepository.js';
import type { BatchRepository, BatchStatus } from '../../repository/batchRepository.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { InboxRepository } from '../../repository/inboxRepository.js';
import type { BatchService } from '../../service/batchService.js';
import type { RenderService } from '../../service/renderService.js';
import type { AddApplicationService } from '../addApplicationService.js';
import type { CompanionActionApplicationService } from '../companionActionApplicationService.js';
import type {
  CompanionRunStatus,
  RunStatusApplicationService,
  RunStatusResult,
} from '../runStatusApplicationService.js';

export class RunStatusApplicationServiceImpl implements RunStatusApplicationService {
  private nextProviderPollAtMs = 0;

  constructor(
    private readonly backgroundAiBatchRepository: BackgroundAiBatchRepository,
    private readonly companionActionApplicationService?: CompanionActionApplicationService,
    private readonly batchRepository?: BatchRepository,
    private readonly batchItemRepository?: BatchItemRepository,
    private readonly batchService?: BatchService,
    private readonly jobRepository?: JobRepository,
    private readonly renderService?: RenderService,
    private readonly artifactWriter: (filePath: string, content: string | Buffer) => Promise<void> = writeArtifactFile,
    private readonly addApplicationService?: AddApplicationService,
    private readonly inboxRepository?: InboxRepository,
    private readonly providerPollIntervalMs = 60_000,
    private readonly nowMs: () => number = Date.now,
  ) {}

  /** @inheritdoc */
  async getRunStatus(runId: string): Promise<RunStatusResult> {
    const localRun = await this.companionActionApplicationService?.getRunStatus(runId);
    if (localRun) return localRun;

    const backgroundBatch = await this.backgroundAiBatchRepository.getBatch(runId);
    if (backgroundBatch) {
      const items = await this.backgroundAiBatchRepository.listItems(runId);
      return {
        runId,
        type: backgroundBatch.type,
        status: mapBackgroundBatchStatus(backgroundBatch.status),
        itemCount: items.length,
        error: backgroundBatch.error,
        artifacts: backgroundBatch.type === 'tailor'
          ? {
              resume: { status: 'not_ready', url: null },
              coverLetter: { status: 'not_ready', url: null },
            }
          : undefined,
      };
    }

    const baseBatchBeforePoll = await this.batchRepository?.get(runId);
    if (baseBatchBeforePoll?.status === 'pending' && this.shouldPollProvider()) {
      await this.batchService?.pollAiBatches();
    }
    const baseBatch = await this.batchRepository?.get(runId);
    if (baseBatch) {
      const items = await this.batchItemRepository?.listByBatch(runId) ?? [];
      let artifactsReady = false;
      let applyError: string | null = null;
      const itemFailureError = baseBatch.status === 'completed' ? batchItemFailureError(items) : null;
      if (baseBatch.type === 'tailor') {
        try {
          artifactsReady = await this.applyCompletedTailorItems(baseBatch.status, items);
        } catch (err) {
          applyError = err instanceof Error ? err.message : String(err);
        }
      } else if (baseBatch.type === 'inbox_promote') {
        try {
          await this.applyCompletedInboxItems(baseBatch.status, items);
        } catch (err) {
          applyError = err instanceof Error ? err.message : String(err);
        }
      }
      return {
        runId,
        type: baseBatch.type,
        status: applyError || itemFailureError ? 'failed' : mapBaseBatchStatus(baseBatch.status),
        itemCount: items.length,
        error: applyError ?? itemFailureError ?? baseBatch.errorMessage,
        artifacts: baseBatch.type === 'tailor'
          ? {
              resume: { status: artifactsReady ? 'ready' : 'not_ready', url: null },
              coverLetter: { status: artifactsReady ? 'ready' : 'not_ready', url: null },
            }
          : undefined,
      };
    }

    {
      return {
        runId,
        status: 'todo',
        error: 'Run status is not tracked yet.',
      };
    }
  }

  private async applyCompletedTailorItems(status: BatchStatus, items: BatchItem[]): Promise<boolean> {
    if (status !== 'completed') return false;
    if (!allItemsSucceeded(items)) return false;
    if (!this.jobRepository || !this.renderService || !this.batchItemRepository) return false;

    for (const item of items) {
      if (item.consumedAt) continue;
      const parsed = parseTailorBatchResult(item.resultText ?? '');
      const workspaceDir = await this.jobRepository.getWorkspaceDir(item.customId);
      const srcDir = path.join(workspaceDir, 'src');
      await this.artifactWriter(path.join(srcDir, 'tailoring-brief.md'), parsed.tailoringBrief);
      await this.artifactWriter(path.join(srcDir, 'resume.html'), parsed.resumeHtml);
      await this.artifactWriter(path.join(srcDir, 'cover_letter.html'), parsed.coverLetterHtml);
      await this.artifactWriter(path.join(workspaceDir, 'resume.pdf'), await this.renderService.renderPdf(parsed.resumeHtml));
      await this.artifactWriter(
        path.join(workspaceDir, 'cover_letter.pdf'),
        await this.renderService.renderCoverLetterPdf(parsed.coverLetterHtml),
      );
      await this.jobRepository.update(item.customId, {
        hasTailoredResume: true,
        hasTailoredCoverLetter: true,
      });
      await this.batchItemRepository.markConsumed(item.id, new Date().toISOString());
    }

    return true;
  }

  private async applyCompletedInboxItems(status: BatchStatus, items: BatchItem[]): Promise<boolean> {
    if (status !== 'completed') return false;
    if (!allItemsSucceeded(items)) return false;
    if (!this.addApplicationService || !this.inboxRepository || !this.batchItemRepository) return false;

    for (const item of items) {
      if (item.consumedAt) continue;
      const parsed = parseInboxBatchResult(item.resultText ?? '');
      const result = await this.addApplicationService.add(parsed);
      await this.inboxRepository.updateStatus(item.customId, {
        status: 'promoted',
        jobId: result.jobId,
        error: null,
      });
      await this.batchItemRepository.markConsumed(item.id, new Date().toISOString());
    }

    return true;
  }

  private shouldPollProvider(): boolean {
    const now = this.nowMs();
    if (now < this.nextProviderPollAtMs) return false;
    this.nextProviderPollAtMs = now + this.providerPollIntervalMs;
    return true;
  }
}

function mapBackgroundBatchStatus(status: BackgroundAiBatchStatus): CompanionRunStatus {
  if (status === 'queued') return 'queued';
  if (status === 'waiting_ai') return 'waiting_ai';
  if (status === 'completed') return 'ready';
  if (status === 'failed' || status === 'partial_failed') return 'failed';
  return 'running';
}

function mapBaseBatchStatus(status: BatchStatus): CompanionRunStatus {
  if (status === 'pending') return 'waiting_ai';
  if (status === 'completed') return 'ready';
  return 'failed';
}

function allItemsSucceeded(items: BatchItem[]): boolean {
  return items.length > 0 && items.every((item) => item.status === 'succeeded');
}

function batchItemFailureError(items: BatchItem[]): string | null {
  const failedItems = items.filter((item) => item.status !== 'succeeded');
  if (failedItems.length === 0) return null;
  const firstError = failedItems.find((item) => item.errorMessage)?.errorMessage;
  return `${failedItems.length} of ${items.length} batch item(s) failed.${firstError ? ` First error: ${firstError}` : ''}`;
}

function parseTailorBatchResult(raw: string): {
  tailoringBrief: string;
  resumeHtml: string;
  coverLetterHtml: string;
} {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(trimmed) as Partial<{
    tailoringBrief: unknown;
    resumeHtml: unknown;
    coverLetterHtml: unknown;
  }>;
  if (
    typeof parsed.tailoringBrief !== 'string' ||
    typeof parsed.resumeHtml !== 'string' ||
    typeof parsed.coverLetterHtml !== 'string'
  ) {
    throw new Error('Batch tailor result is missing tailoringBrief, resumeHtml, or coverLetterHtml.');
  }
  return {
    tailoringBrief: parsed.tailoringBrief,
    resumeHtml: parsed.resumeHtml,
    coverLetterHtml: parsed.coverLetterHtml,
  };
}

function parseInboxBatchResult(raw: string): {
  title: string;
  company: string;
  url: string;
  jdText: string;
} {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(trimmed) as Partial<{
    title: unknown;
    company: unknown;
    url: unknown;
    jdText: unknown;
  }>;
  if (
    typeof parsed.title !== 'string' ||
    typeof parsed.company !== 'string' ||
    typeof parsed.url !== 'string' ||
    typeof parsed.jdText !== 'string'
  ) {
    throw new Error('Inbox batch result is missing title, company, url, or jdText.');
  }
  return {
    title: parsed.title,
    company: parsed.company,
    url: parsed.url,
    jdText: parsed.jdText,
  };
}

async function writeArtifactFile(filePath: string, content: string | Buffer): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}
