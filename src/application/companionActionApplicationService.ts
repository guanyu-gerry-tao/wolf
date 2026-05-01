import type { Page } from 'playwright';
import type { RunStatusResult } from './runStatusApplicationService.js';

export interface QuickTailorInput {
  jobId: string;
  userPrompt?: string;
  artifactTargets: ('resume' | 'cover_letter')[];
}

export interface BatchTailorInput {
  jobIds?: string[];
  statusFilter?: string;
  userPrompt?: string;
}

export interface QuickFillInput {
  jobId: string;
  tabId?: string | number | null;
  userPrompt?: string;
  page: Page | null;
}

export interface CompanionActionStartResult {
  runId: string;
  status: 'queued' | 'running';
}

export interface CompanionActionApplicationService {
  quickTailor(input: QuickTailorInput): Promise<CompanionActionStartResult>;
  batchTailor(input: BatchTailorInput): Promise<CompanionActionStartResult>;
  quickFill(input: QuickFillInput): Promise<CompanionActionStartResult>;
  getRunStatus(runId: string): Promise<RunStatusResult | null>;
}
