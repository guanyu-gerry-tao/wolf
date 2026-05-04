export type CompanionRunStatus = 'queued' | 'running' | 'waiting_ai' | 'ready' | 'failed' | 'todo';

export interface ArtifactSlotStatus {
  status: 'not_ready' | 'ready';
  url: string | null;
}

export interface RunStatusResult {
  runId: string;
  status: CompanionRunStatus;
  type?: string;
  itemCount?: number;
  error?: string | null;
  artifacts?: {
    resume: ArtifactSlotStatus;
    coverLetter: ArtifactSlotStatus;
  };
}

export interface RunStatusApplicationService {
  getRunStatus(runId: string): Promise<RunStatusResult>;
}
