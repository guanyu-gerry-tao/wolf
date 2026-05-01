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

  // Promote is the explicit paid step: the daemon creates background batch
  // state and returns 202 rather than doing synchronous AI/job creation.
  it('routes POST /api/inbox/promote to the inbox promotion application', async () => {
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
    expect(res.body).toMatchObject({
      batchId: 'batch-1',
      status: 'queued',
      itemCount: 20,
      shardCount: 1,
    });
  });

  // HTTP-first is being introduced as a visible surface before every command
  // is migrated. Unwired routes should fail predictably with 501.
  it.each([
    ['GET', '/api/jobs'],
    ['GET', '/api/jobs/job-1'],
    ['POST', '/api/tailor'],
    ['POST', '/api/score'],
    ['POST', '/api/fill'],
    ['GET', '/api/status'],
    ['GET', '/api/profile'],
  ])('returns 501 for %s %s until the command is wired', async (method, url) => {
    const res = await dispatchHttpRequest({
      method,
      url,
      version: '0.1.0',
      body: '{}',
    });

    expect(res.status).toBe(501);
    expect(res.body).toMatchObject({ error: 'not implemented' });
  });
});
