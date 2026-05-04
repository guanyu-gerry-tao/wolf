import type { Page } from 'playwright';

export interface StagehandFillInput {
  page: Page;
  jobId: string;
  userPrompt?: string;
  profileMarkdown: string;
  fillValues: Record<string, string>;
}

export interface StagehandFillResult {
  mode: 'stagehand' | 'fallback_required';
  filledFields: number;
  warnings: string[];
}

export interface StagehandFillService {
  fill(input: StagehandFillInput): Promise<StagehandFillResult>;
}
