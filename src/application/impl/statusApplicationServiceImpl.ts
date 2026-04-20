import { log } from '../../utils/logger.js';
import type {
  StatusApplicationService,
  StatusCount,
  StatusCounter,
  StatusSummary,
} from '../statusApplicationService.js';

/**
 * Default StatusApplicationService — fans out over the registered counters
 * in parallel and aggregates results. A single counter's failure does not
 * abort the whole summary; the failed counter returns 0 and records its
 * error in the StatusCount so the CLI can surface it without breaking the
 * rest of the dashboard.
 */
export class StatusApplicationServiceImpl implements StatusApplicationService {
  constructor(
    private readonly counters: StatusCounter[],
  ) {}

  async getSummary(): Promise<StatusSummary> {
    const counters = await Promise.all(
      this.counters.map(async ({ label, count }): Promise<StatusCount> => {
        try {
          return { label, count: await count() };
        } catch (err) {
          // Each failed counter logs a warn event (visible in data/logs/wolf.log.jsonl)
          // and still returns count: 0 + an inline error so the dashboard
          // keeps rendering. One broken counter must not kill the whole view.
          const message = err instanceof Error ? err.message : String(err);
          log.warn('status.counter.failed', { label, error: message });
          return { label, count: 0, error: message };
        }
      }),
    );
    return { counters };
  }
}
