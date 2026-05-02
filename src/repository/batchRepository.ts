/** What this batch is for — drives the result handler that runs on completion. */
export type BatchType = "score" | "tailor";

/** AI provider behind the batch. Different providers expose different APIs. */
export type BatchAiProvider = "anthropic" | "openai";

/** Lifecycle state for a batch row. */
export type BatchStatus = "pending" | "completed" | "failed";

/** One row in the `batches` table. */
export interface Batch {
  id: string;
  /** External ID returned by the AI provider on submit. */
  batchId: string;
  type: BatchType;
  aiProvider: BatchAiProvider;
  model: string | null;
  profileId: string;
  status: BatchStatus;
  errorMessage: string | null;
  /** ISO 8601 — when wolf submitted the batch. */
  submittedAt: string;
  /** ISO 8601 — when the provider reported completion; null while pending. */
  completedAt: string | null;
}

/**
 * Repository for AI batch metadata. Generic on purpose so any future
 * batch-driven workflow (scoring, tailoring, …) reuses the same storage and
 * polling machinery rather than each command minting its own.
 */
export interface BatchRepository {
  /** Inserts or replaces the batch row by `id`. */
  save(batch: Batch): Promise<void>;
  /** Returns every batch still in `pending` state. */
  getPending(): Promise<Batch[]>;
  /** Marks a batch complete and stamps `completedAt`. */
  markComplete(id: string, completedAt: string): Promise<void>;
  /** Marks a batch failed (terminal state — no retry by design). */
  markFailed(id: string, errorMessage?: string): Promise<void>;
}
