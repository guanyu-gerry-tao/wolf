/**
 * StatusApplicationService — produces the dashboard summary for `wolf status`.
 *
 * Each module contributes one StatusCounter to the registry wired in
 * appContext.ts (e.g. tracked, tailored, applied). The service runs every
 * counter in parallel and returns a StatusSummary. Adding a new feature
 * (hunt, fill, reach) means registering one counter — never editing the
 * status command, service, or other counters.
 */
export interface StatusApplicationService {
  getSummary(): Promise<StatusSummary>;
}

/**
 * One registered dashboard counter. Held by closure over whatever repo or
 * service knows how to compute the number.
 */
export interface StatusCounter {
  label: string;
  count: () => Promise<number>;
}

export interface StatusSummary {
  counters: StatusCount[];
}

export interface StatusCount {
  label: string;
  count: number;
  /** Set only when this counter's count() threw — the summary still returns. */
  error?: string;
}
