import { Stagehand } from '@browserbasehq/stagehand';
import type { StagehandFillInput, StagehandFillResult, StagehandFillService } from '../stagehandFillService.js';

export class StagehandFillServiceImpl implements StagehandFillService {
  /** @inheritdoc */
  async fill(input: StagehandFillInput): Promise<StagehandFillResult> {
    // TODO(companion-stagehand): Instantiate Stagehand LOCAL against the
    // wolf-controlled browser session, then implement observe/cache/replay.
    // Reason: Stagehand v3 can own or connect to a local browser, but wolf's
    // current ServeBrowserManager exposes a Playwright Page rather than a CDP
    // endpoint/session pool. Keeping this as a service boundary lets the next
    // pass wire CDP without changing companion HTTP or UI contracts.
    void Stagehand;
    void input;
    return {
      mode: 'fallback_required',
      filledFields: 0,
      warnings: [
        'Stagehand LOCAL observe/cache/replay is installed but not wired yet; falling back to safe Playwright field filling.',
      ],
    };
  }
}
