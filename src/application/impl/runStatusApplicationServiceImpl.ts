import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BackgroundAiBatchStatus } from '../../repository/backgroundAiBatchRepository.js';
import type { BackgroundAiBatchRepository } from '../../repository/backgroundAiBatchRepository.js';
import type { BatchItem, BatchItemRepository } from '../../repository/batchItemRepository.js';
import type { BatchRepository, BatchStatus } from '../../repository/batchRepository.js';
import type { JobRepository } from '../../repository/jobRepository.js';
import type { BatchService } from '../../service/batchService.js';
import type { RenderService } from '../../service/renderService.js';
import type { CompanionActionApplicationService } from '../companionActionApplicationService.js';
import type {
  CompanionRunStatus,
  RunStatusApplicationService,
  RunStatusResult,
} from '../runStatusApplicationService.js';

export class RunStatusApplicationServiceImpl implements RunStatusApplicationService {
  constructor(
    private readonly backgroundAiBatchRepository: BackgroundAiBatchRepository,
    private readonly companionActionApplicationService?: CompanionActionApplicationService,
    private readonly batchRepository?: BatchRepository,
    private readonly batchItemRepository?: BatchItemRepository,
    private readonly batchService?: BatchService,
    private readonly jobRepository?: JobRepository,
    private readonly renderService?: RenderService,
    private readonly artifactWriter: (filePath: string, content: string | Buffer) => Promise<void> = writeArtifactFile,
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
    if (baseBatchBeforePoll?.status === 'pending') {
      await this.batchService?.pollAiBatches();
    }
    const baseBatch = await this.batchRepository?.get(runId);
    if (baseBatch) {
      const items = await this.batchItemRepository?.listByBatch(runId) ?? [];
      let artifactsReady = false;
      let applyError: string | null = null;
      if (baseBatch.type === 'tailor') {
        try {
          artifactsReady = await this.applyCompletedTailorItems(baseBatch.status, items);
        } catch (err) {
          applyError = err instanceof Error ? err.message : String(err);
        }
      }
      return {
        runId,
        type: baseBatch.type,
        status: applyError ? 'failed' : mapBaseBatchStatus(baseBatch.status),
        itemCount: items.length,
        error: applyError ?? baseBatch.errorMessage,
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

async function writeArtifactFile(filePath: string, content: string | Buffer): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}
