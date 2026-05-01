export interface BackgroundAiBatchWorkerTickResult {
  clearedDebugCount: number;
  dueShardCount: number;
}

export interface BackgroundAiBatchWorker {
  tick(now?: Date): Promise<BackgroundAiBatchWorkerTickResult>;
}
