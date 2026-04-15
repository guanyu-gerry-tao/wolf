export type BatchType = "score" | "tailor";
export type BatchAiProvider = "anthropic" | "openai";
export type BatchStatus = "pending" | "completed" | "failed";

export interface Batch {
  id: string;
  batchId: string;        // external ID from AI provider
  type: BatchType;
  aiProvider: BatchAiProvider;
  profileId: string;
  status: BatchStatus;
  submittedAt: string;    // ISO 8601
  completedAt: string | null;
}

export interface BatchRepository {
  save(batch: Batch): Promise<void>;
  getPending(): Promise<Batch[]>;
  markComplete(id: string, completedAt: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}
