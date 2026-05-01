import { describe, expect, it } from 'vitest';
import { dispatchHttpRequest } from '../impl/nodeHttpServerImpl.js';

describe('NodeHttpServerImpl', () => {
  // Pins the daemon route contract the Chrome side panel already calls. The
  // pure dispatcher keeps the unit test independent of local socket policy.
  it('serves GET /api/ping with an echoed nonce', async () => {
    const res = await dispatchHttpRequest({
      method: 'GET',
      url: '/api/ping?nonce=abc123',
      version: '0.1.0',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nonce: 'abc123',
      version: '0.1.0',
    });
    expect(() => new Date((res.body as { serverTime: string }).serverTime).toISOString()).not.toThrow();
  });

  // The nonce is required because the side panel uses it as a tiny liveness
  // check, not just a generic "server answered something" check.
  it('rejects ping without a nonce', async () => {
    const res = await dispatchHttpRequest({
      method: 'GET',
      url: '/api/ping',
      version: '0.1.0',
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'missing nonce' });
  });

  // Runtime status lets the side panel block automation until wolf owns a
  // dedicated browser instance instead of quietly operating on the user's main
  // Chrome profile.
  it('serves GET /api/runtime/status with browser readiness details', async () => {
    const res = await dispatchHttpRequest({
      method: 'GET',
      url: '/api/runtime/status',
      version: '0.1.0',
      workspacePath: '/tmp/wolf-test/workspace',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      version: '0.1.0',
      workspacePath: '/tmp/wolf-test/workspace',
      browser: {
        status: 'not_started',
        detail: 'Wolf browser launch is not implemented yet.',
        requiredAction: 'Start the browser from wolf serve, then reconnect.',
      },
      profile: {
        status: 'unknown',
      },
      features: {
        browserInstance: false,
      },
    });
  });

  // The side panel's "Import current page" route stores raw DOM only. The HTTP
  // layer validates the wire payload, then lets the inbox application own SQLite.
  it('routes POST /api/inbox/items to the inbox application', async () => {
    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/inbox/items',
      version: '0.1.0',
      body: JSON.stringify({
        kind: 'manual_page',
        source: 'wolf_companion',
        title: 'Software Engineer',
        url: 'https://example.com/jobs/1',
        html: '<html><body>raw</body></html>',
        visibleText: 'ignored by raw inbox',
        capturedAt: '2026-05-01T00:00:00.000Z',
      }),
      inboxApp: {
        saveCurrentPage: async (input) => ({
          inboxId: 'manual-1',
          status: input.kind === 'manual_page' ? 'raw' : 'failed',
        }),
        findDuplicateManualPage: async () => null,
        saveHuntRun: async () => {
          throw new Error('not used');
        },
      },
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      inboxId: 'manual-1',
      status: 'raw',
    });
  });

  // Keep the first MVP route as a compatibility alias while the extension moves
  // to the clearer /api/inbox/items name.
  it('keeps POST /api/inbox/current-page as a compatibility alias', async () => {
    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/inbox/current-page',
      version: '0.1.0',
      body: JSON.stringify({
        title: 'Software Engineer',
        url: 'https://example.com/jobs/1',
        html: '<html><body>raw</body></html>',
        capturedAt: '2026-05-01T00:00:00.000Z',
      }),
      inboxApp: {
        saveCurrentPage: async () => ({ inboxId: 'manual-1', status: 'raw' }),
        findDuplicateManualPage: async () => null,
        saveHuntRun: async () => { throw new Error('not used'); },
      },
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      inboxId: 'manual-1',
      status: 'raw',
    });
  });

  // Duplicate checks are intentionally URL-only and do not require DOM access
  // or site permissions from the current tab.
  it('routes GET /api/inbox/duplicate-check to the inbox application', async () => {
    const res = await dispatchHttpRequest({
      method: 'GET',
      url: '/api/inbox/duplicate-check?url=https%3A%2F%2Fexample.com%2Fjobs%2F1%3Futm_source%3Dx',
      version: '0.1.0',
      inboxApp: {
        saveCurrentPage: async () => {
          throw new Error('not used');
        },
        saveHuntRun: async () => {
          throw new Error('not used');
        },
        findDuplicateManualPage: async (url) => ({
          id: 'manual-1',
          kind: 'manual_page',
          source: 'wolf_companion',
          url,
          title: 'Software Engineer',
          rawJson: '{}',
          rawSha256: 'sha',
          status: 'raw',
          jobId: null,
          receivedAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
          error: null,
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      duplicate: true,
      inboxId: 'manual-1',
      title: 'Software Engineer',
      url: 'https://example.com/jobs/1?utm_source=x',
    });
  });

  // Process Inbox is the explicit paid step: the daemon creates background batch
  // state and returns 202 rather than doing synchronous AI/job creation.
  it('routes POST /api/inbox/process to the inbox promotion application', async () => {
    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/inbox/process',
      version: '0.1.0',
      body: JSON.stringify({ limit: 20, shardSize: 20 }),
      inboxPromotionApp: {
        promoteRawInbox: async (input) => ({
          batchId: 'batch-1',
          status: 'queued',
          itemCount: input.limit,
          shardCount: 1,
        }),
      },
    });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      batchId: 'batch-1',
      status: 'queued',
      itemCount: 20,
      shardCount: 1,
    });
  });

  // Keep the earlier MVP route as a compatibility alias while the side panel
  // moves from "Promote" language to "Process Inbox".
  it('keeps POST /api/inbox/promote as a compatibility alias', async () => {
    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/inbox/promote',
      version: '0.1.0',
      body: JSON.stringify({ limit: 20, shardSize: 20 }),
      inboxPromotionApp: {
        promoteRawInbox: async (input) => ({
          batchId: 'batch-1',
          status: 'queued',
          itemCount: input.limit,
          shardCount: 1,
        }),
      },
    });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ batchId: 'batch-1', status: 'queued' });
  });

  // Artifact readiness has a stable response shape before the actual artifact
  // service lands, so the side panel can render clear Not Ready buttons.
  it('serves TODO artifact readiness with not-ready artifact slots', async () => {
    const res = await dispatchHttpRequest({
      method: 'GET',
      url: '/api/jobs/job-1/artifacts',
      version: '0.1.0',
    });

    expect(res.status).toBe(501);
    expect(res.body).toMatchObject({
      status: 'todo',
      jobId: 'job-1',
      resume: { status: 'not_ready', url: null },
      coverLetter: { status: 'not_ready', url: null },
    });
  });

  // Run polling uses one shared route for inbox processing, tailor, regenerate,
  // and fill so the side panel does not need one polling mechanism per feature.
  it('routes GET /api/runs/:runId to the run status application when available', async () => {
    const res = await dispatchHttpRequest({
      method: 'GET',
      url: '/api/runs/run-1',
      version: '0.1.0',
      runStatusApp: {
        getRunStatus: async (runId) => ({
          runId,
          status: 'waiting_ai',
          type: 'tailor',
          itemCount: 2,
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      runId: 'run-1',
      status: 'waiting_ai',
      type: 'tailor',
      itemCount: 2,
    });
  });

  // Even while quick tailor is a TODO backend, the HTTP boundary should reject
  // malformed companion payloads instead of accepting an unusable run request.
  it('validates prompt-powered TODO request bodies before returning TODO', async () => {
    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/tailor/quick',
      version: '0.1.0',
      body: '{}',
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'invalid quick tailor request' });
  });

  // The companion UI is allowed to depend on stable HTTP paths before every
  // underlying service exists. Missing services must return structured TODO
  // responses, not vague 404s or one-off error strings.
  it.each([
    ['POST', '/api/browser/open', '{}'],
    ['GET', '/api/tabs', '{}'],
    ['POST', '/api/tabs/tab-1/focus', '{}'],
    ['GET', '/api/runs/run-1', '{}'],
    ['GET', '/api/jobs', '{}'],
    ['GET', '/api/jobs/job-1', '{}'],
    ['GET', '/api/jobs/job-1/artifacts/resume', '{}'],
    ['GET', '/api/jobs/job-1/artifacts/cover-letter', '{}'],
    ['POST', '/api/tailor/quick', '{"jobId":"job-1"}'],
    ['POST', '/api/tailor/batch', '{"jobIds":["job-1"]}'],
    ['POST', '/api/artifacts/regenerate', '{"jobId":"job-1","artifactType":"resume","existingArtifactText":"","userPrompt":"tighten bullets"}'],
    ['POST', '/api/fill/quick', '{"jobId":"job-1","tabId":"tab-1"}'],
    ['GET', '/api/config', '{}'],
    ['POST', '/api/config', '{}'],
    ['POST', '/api/tailor', '{}'],
    ['POST', '/api/score', '{}'],
    ['POST', '/api/fill', '{}'],
    ['GET', '/api/status', '{}'],
    ['GET', '/api/profile', '{}'],
  ])('returns 501 for %s %s until the command is wired', async (method, url, body) => {
    const res = await dispatchHttpRequest({
      method,
      url,
      version: '0.1.0',
      body,
    });

    expect(res.status).toBe(501);
    expect(res.body).toMatchObject({
      status: 'todo',
      todo: expect.any(String),
      nextStep: expect.any(String),
    });
  });
});
