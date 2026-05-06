import { describe, expect, it, vi } from 'vitest';
import { dispatchHttpRequest } from '../impl/nodeHttpServerImpl.js';
import type { ScoreApplicationService } from '../../application/scoreApplicationService.js';
import type { ScoreOptions, ScoreResult } from '../../utils/types/index.js';

// Build a stub ScoreApplicationService with a vi.fn() that we can assert on.
// The HTTP layer should pass parsed request bodies straight through to it
// and surface its return value verbatim.
function makeStubScoreApp(returnValue: ScoreResult): {
  scoreApp: ScoreApplicationService;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn().mockResolvedValue(returnValue);
  const scoreApp: ScoreApplicationService = {
    score: spy as (options: ScoreOptions) => Promise<ScoreResult>,
  };
  return { scoreApp, spy };
}

describe('POST /api/score (v3 tier model)', () => {
  // Happy path: empty body validates as `{}`, default mode kicks in, and
  // the ScoreResult is echoed verbatim.
  it('routes an empty body to default-mode score and returns ScoreResult', async () => {
    const { scoreApp, spy } = makeStubScoreApp({ submitted: 5 });
    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/score',
      version: '0.1.0',
      body: '{}',
      scoreApp,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ submitted: 5 });
    expect(spy).toHaveBeenCalledWith({});
  });

  // Single-mode round-trip — verifies all the new tier-shaped response
  // fields (singleTier index + singleTierName + singleMd) come back through
  // the route unchanged.
  it('forwards ScoreOptions verbatim and returns single-mode tier fields', async () => {
    const { scoreApp, spy } = makeStubScoreApp({
      submitted: 1,
      singleTier: 2,
      singleTierName: 'tailor',
      singleMd: '## Tier\ntailor\n\n## Pros\n- backend Go\n\n## Cons\n- onsite\n',
    });
    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/score',
      version: '0.1.0',
      body: JSON.stringify({
        profileId: 'ng-swe',
        jobIds: ['job-a', 'job-b'],
        single: true,
        aiModel: 'anthropic/claude-haiku-4-5-20251001',
      }),
      scoreApp,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      submitted: 1,
      singleTier: 2,
      singleTierName: 'tailor',
    });
    expect(spy).toHaveBeenCalledWith({
      profileId: 'ng-swe',
      jobIds: ['job-a', 'job-b'],
      single: true,
      aiModel: 'anthropic/claude-haiku-4-5-20251001',
    });
  });

  // Invalid body shape is rejected before any work happens. Guards the
  // contract so a misconfigured client fails fast rather than reaching the
  // AI stack.
  it('rejects an invalid body with 400 and does not call scoreApp', async () => {
    const { scoreApp, spy } = makeStubScoreApp({ submitted: 0 });
    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/score',
      version: '0.1.0',
      body: JSON.stringify({ jobIds: [42] }),
      scoreApp,
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'invalid score request' });
    expect(spy).not.toHaveBeenCalled();
  });

  // Missing scoreApp wiring returns 503 (matches the existing inboxApp
  // pattern) so a client can distinguish "not configured" from "request bad".
  it('returns 503 when scoreApp is not wired', async () => {
    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/score',
      version: '0.1.0',
      body: '{}',
    });

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: 'score unavailable' });
  });

  // Malformed JSON (not just bad shape — actually unparseable) goes through
  // the shared parseJsonBody helper and returns 400.
  it('rejects unparseable JSON with 400', async () => {
    const { scoreApp } = makeStubScoreApp({ submitted: 0 });
    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/score',
      version: '0.1.0',
      body: 'not json',
      scoreApp,
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'invalid json' });
  });
});
