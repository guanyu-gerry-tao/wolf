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
        getStatus: async () => ({ hasRaw: true, rawCount: 1 }),
        deleteItem: async () => ({ inboxId: 'manual-1', status: 'deleted' }),
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
        getStatus: async () => ({ hasRaw: true, rawCount: 1 }),
        deleteItem: async () => ({ inboxId: 'manual-1', status: 'deleted' }),
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
        getStatus: async () => ({ hasRaw: true, rawCount: 1 }),
        deleteItem: async () => ({ inboxId: 'manual-1', status: 'deleted' }),
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

  // The side panel's duplicate-state X removes the import record from the raw
  // inbox. It intentionally does not delete any promoted job rows yet.
  it('routes DELETE /api/inbox/items/:id to the inbox application', async () => {
    const res = await dispatchHttpRequest({
      method: 'DELETE',
      url: '/api/inbox/items/manual-1',
      version: '0.1.0',
      inboxApp: {
        saveCurrentPage: async () => {
          throw new Error('not used');
        },
        saveHuntRun: async () => {
          throw new Error('not used');
        },
        findDuplicateManualPage: async () => null,
        getStatus: async () => ({ hasRaw: false, rawCount: 0 }),
        deleteItem: async (id) => ({ inboxId: id, status: 'deleted' }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inboxId: 'manual-1', status: 'deleted' });
  });

  // The side panel gates "Process Inbox" on this lightweight local status
  // check, so clicking it does not become the user's way to discover an empty
  // inbox.
  it('routes GET /api/inbox/status to the inbox application', async () => {
    const res = await dispatchHttpRequest({
      method: 'GET',
      url: '/api/inbox/status',
      version: '0.1.0',
      inboxApp: {
        saveCurrentPage: async () => {
          throw new Error('not used');
        },
        saveHuntRun: async () => {
          throw new Error('not used');
        },
        findDuplicateManualPage: async () => null,
        getStatus: async () => ({ hasRaw: false, rawCount: 0 }),
        deleteItem: async () => ({ inboxId: 'manual-1', status: 'deleted' }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasRaw: false, rawCount: 0 });
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
        promoteInboxItem: async () => ({
          batchId: 'batch-1',
          status: 'queued',
          itemCount: 1,
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
        promoteInboxItem: async () => ({
          batchId: 'batch-1',
          status: 'queued',
          itemCount: 1,
          shardCount: 1,
        }),
      },
    });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ batchId: 'batch-1', status: 'queued' });
  });

  // The side panel can process a single imported page without also processing
  // every raw inbox item.
  it('routes POST /api/inbox/items/:id/process to single-item inbox promotion', async () => {
    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/inbox/items/manual-1/process',
      version: '0.1.0',
      body: JSON.stringify({ shardSize: 1 }),
      inboxPromotionApp: {
        promoteRawInbox: async () => {
          throw new Error('not used');
        },
        promoteInboxItem: async (id, input) => ({
          batchId: `${id}-batch`,
          status: 'queued',
          itemCount: input.shardSize,
          shardCount: 1,
        }),
      },
    });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      batchId: 'manual-1-batch',
      status: 'queued',
      itemCount: 1,
      shardCount: 1,
    });
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

  // Browser and tab routes should become real as soon as serve has a browser
  // manager, while still staying unit-testable through the pure dispatcher.
  it('routes browser open, tab list, and tab focus through the browser manager', async () => {
    const browserManager = {
      open: async () => ({
        status: 'ready' as const,
        detail: 'ready',
        requiredAction: 'Use wolf browser.',
      }),
      openUrl: async (url: string) => ({
        id: 'wolf-tab-2',
        title: 'Opened Role',
        url,
        tabId: 'wolf-tab-2',
        windowId: null,
        company: 'example.com',
      }),
      listTabs: async () => ({
        queues: {
          filling: [{ id: 'tab-1', title: 'Role', url: 'https://example.com', tabId: 'tab-1', windowId: null, company: 'Example' }],
          ready: [],
          stuck: [],
        },
      }),
      focusTab: async (tabId: string) => ({ id: tabId, title: 'Role', url: 'https://example.com', tabId, windowId: null, company: 'Example' }),
      status: () => ({
        status: 'ready' as const,
        detail: 'ready',
        requiredAction: 'Use wolf browser.',
      }),
      getPage: async () => null,
      stop: async () => undefined,
    };

    await expect(dispatchHttpRequest({
      method: 'POST',
      url: '/api/browser/open',
      version: '0.1.0',
      browserManager,
    })).resolves.toMatchObject({ status: 200, body: { status: 'ready' } });

    await expect(dispatchHttpRequest({
      method: 'GET',
      url: '/api/tabs',
      version: '0.1.0',
      browserManager,
    })).resolves.toMatchObject({ status: 200, body: { queues: { filling: [expect.objectContaining({ id: 'tab-1' })] } } });

    await expect(dispatchHttpRequest({
      method: 'POST',
      url: '/api/tabs/tab-1/focus',
      version: '0.1.0',
      browserManager,
    })).resolves.toMatchObject({ status: 200, body: { id: 'tab-1' } });
  });

  // The side panel needs the Batch Tailor count to represent jobs still missing
  // tailor artifacts, not merely open browser tabs. Completed jobs should not
  // re-enter the Ready column or the Batch Tailor count.
  it('adds untailored job counts and ready jobs to GET /api/tabs', async () => {
    const res = await dispatchHttpRequest({
      method: 'GET',
      url: '/api/tabs',
      version: '0.1.0',
      browserManager: {
        open: async () => ({ status: 'ready' as const, detail: 'ready', requiredAction: 'Use wolf browser.' }),
        openUrl: async () => { throw new Error('not used'); },
        listTabs: async () => ({ queues: { filling: [], ready: [], stuck: [] } }),
        focusTab: async () => { throw new Error('not used'); },
        status: () => ({ status: 'ready' as const, detail: 'ready', requiredAction: 'Use wolf browser.' }),
        getPage: async () => null,
        stop: async () => undefined,
      },
      jobRepository: {
        query: async () => [
          {
            id: 'job-1',
            title: 'Needs Tailor',
            companyId: 'company-1',
            url: 'https://example.com/job-1',
            hasTailoredResume: false,
            hasTailoredCoverLetter: false,
          },
          {
            id: 'job-2',
            title: 'Already Tailored',
            companyId: 'company-1',
            url: 'https://example.com/job-2',
            hasTailoredResume: true,
            hasTailoredCoverLetter: true,
          },
        ],
        countWithoutCompleteTailor: async () => 1,
      } as never,
      companyRepository: {
        get: async () => ({ name: 'Acme' }),
      } as never,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      counts: { untailoredJobs: 1 },
      queues: {
        ready: [
          expect.objectContaining({
            jobId: 'job-1',
            title: 'Needs Tailor',
          }),
        ],
      },
    });
  });

  // Ready-column jobs are database rows, not already-open browser tabs. Focusing
  // one should open its canonical URL inside the wolf-controlled browser.
  it('opens a ready job URL in the wolf browser when focusing a job tab id', async () => {
    const browserManager = {
      open: async () => ({ status: 'ready' as const, detail: 'ready', requiredAction: 'Use wolf browser.' }),
      openUrl: async (url: string) => ({
        id: 'wolf-tab-2',
        title: 'Opened Role',
        url,
        tabId: 'wolf-tab-2',
        windowId: null,
        company: 'example.com',
      }),
      listTabs: async () => ({ queues: { filling: [], ready: [], stuck: [] } }),
      focusTab: async () => { throw new Error('job ids should open by URL'); },
      status: () => ({ status: 'ready' as const, detail: 'ready', requiredAction: 'Use wolf browser.' }),
      getPage: async () => null,
      stop: async () => undefined,
    };

    const res = await dispatchHttpRequest({
      method: 'POST',
      url: '/api/tabs/job-job-1/focus',
      version: '0.1.0',
      browserManager,
      jobRepository: {
        get: async () => ({ id: 'job-1', url: 'https://example.com/apply/1' }),
      } as never,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tabId: 'wolf-tab-2',
      url: 'https://example.com/apply/1',
    });
  });

  // With the companion action service wired, quick and batch tailor both return
  // async run IDs. Batch tailor uses the provider Batch API underneath, so the
  // route must call the action service instead of returning the old manual block.
  it('routes quick tailor and batch tailor through companion actions', async () => {
    let batchTailorCalls = 0;
    const companionActionApp = {
      quickTailor: async () => ({ runId: 'quick-1', status: 'queued' as const }),
      batchTailor: async () => {
        batchTailorCalls += 1;
        return { runId: 'batch-1', status: 'queued' as const };
      },
      regenerateArtifact: async () => ({ runId: 'regen-1', status: 'queued' as const }),
      quickFill: async () => ({ runId: 'fill-1', status: 'queued' as const }),
      getRunStatus: async () => null,
    };

    await expect(dispatchHttpRequest({
      method: 'POST',
      url: '/api/tailor/quick',
      version: '0.1.0',
      body: '{"jobId":"job-1","userPrompt":"focus backend"}',
      companionActionApp,
    })).resolves.toMatchObject({ status: 202, body: { runId: 'quick-1' } });

    await expect(dispatchHttpRequest({
      method: 'POST',
      url: '/api/tailor/batch',
      version: '0.1.0',
      body: '{"jobIds":["job-1"]}',
      companionActionApp,
    })).resolves.toMatchObject({ status: 202, body: { runId: 'batch-1' } });

    expect(batchTailorCalls).toBe(1);

    await expect(dispatchHttpRequest({
      method: 'POST',
      url: '/api/artifacts/regenerate',
      version: '0.1.0',
      body: '{"jobId":"job-1","artifactType":"resume","existingArtifactText":"old","userPrompt":"tighten bullets"}',
      companionActionApp,
    })).resolves.toMatchObject({ status: 202, body: { runId: 'regen-1' } });
  });

  // Quick fill needs both the action service and the wolf browser page. The
  // implementation remains no-auto-submit; Stagehand observe/cache/replay is a
  // later TODO behind the action boundary.
  it('routes quick fill through companion actions with a browser page', async () => {
    const page = null;
    const companionActionApp = {
      quickTailor: async () => ({ runId: 'quick-1', status: 'queued' as const }),
      batchTailor: async () => ({ runId: 'batch-1', status: 'queued' as const }),
      regenerateArtifact: async () => ({ runId: 'regen-1', status: 'queued' as const }),
      quickFill: async () => ({ runId: 'fill-1', status: 'queued' as const }),
      getRunStatus: async () => null,
    };
    const browserManager = {
      open: async () => ({ status: 'ready' as const, detail: 'ready', requiredAction: 'Use wolf browser.' }),
      openUrl: async () => { throw new Error('not used'); },
      listTabs: async () => ({ queues: { filling: [], ready: [], stuck: [] } }),
      focusTab: async () => { throw new Error('not used'); },
      status: () => ({ status: 'ready' as const, detail: 'ready', requiredAction: 'Use wolf browser.' }),
      getPage: async () => page,
      stop: async () => undefined,
    };

    await expect(dispatchHttpRequest({
      method: 'POST',
      url: '/api/fill/quick',
      version: '0.1.0',
      body: '{"jobId":"job-1","tabId":"tab-1"}',
      companionActionApp,
      browserManager,
    })).resolves.toMatchObject({ status: 202, body: { runId: 'fill-1' } });
  });

  // Browser config is a form-shaped view over wolf.toml. The HTTP layer keeps
  // the extension independent from dot-path config commands while still
  // exposing all user-editable workspace config fields.
  it('routes workspace config reads, writes, and resets through the config application service', async () => {
    const configApp = {
      get: async () => 'unused',
      set: async () => ({ key: 'unused', coerced: 'unused' }),
      getWorkspaceConfig: async () => ({
        default: 'default',
        hunt: { minScore: 0.5, maxResults: 50 },
        tailor: { model: 'anthropic/claude-sonnet-4-6', defaultCoverLetterTone: 'professional' },
        score: { model: 'anthropic/claude-sonnet-4-6' },
        reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
        fill: { model: 'anthropic/claude-haiku-4-5-20251001' },
      }),
      updateWorkspaceConfig: async (update: {
        default?: string;
        hunt?: { minScore?: number; maxResults?: number };
      }) => ({
        default: update.default ?? 'default',
        hunt: { minScore: update.hunt?.minScore ?? 0.5, maxResults: update.hunt?.maxResults ?? 50 },
        tailor: { model: 'anthropic/claude-sonnet-4-6', defaultCoverLetterTone: 'professional' },
        score: { model: 'anthropic/claude-sonnet-4-6' },
        reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
        fill: { model: 'anthropic/claude-haiku-4-5-20251001' },
      }),
      resetWorkspaceConfig: async () => ({
        default: 'default',
        hunt: { minScore: 0.5, maxResults: 50 },
        tailor: { model: 'anthropic/claude-sonnet-4-6', defaultCoverLetterTone: 'professional' },
        score: { model: 'anthropic/claude-sonnet-4-6' },
        reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
        fill: { model: 'anthropic/claude-haiku-4-5-20251001' },
      }),
    };

    await expect(dispatchHttpRequest({
      method: 'GET',
      url: '/api/config',
      version: '0.1.0',
      configApp,
    })).resolves.toMatchObject({
      status: 200,
      body: { default: 'default', hunt: { minScore: 0.5, maxResults: 50 } },
    });

    await expect(dispatchHttpRequest({
      method: 'POST',
      url: '/api/config',
      version: '0.1.0',
      body: '{"default":"gc","hunt":{"minScore":0.75,"maxResults":25}}',
      configApp,
    })).resolves.toMatchObject({
      status: 200,
      body: { status: 'saved', default: 'gc', hunt: { minScore: 0.75, maxResults: 25 } },
    });

    await expect(dispatchHttpRequest({
      method: 'POST',
      url: '/api/config/reset',
      version: '0.1.0',
      configApp,
    })).resolves.toMatchObject({
      status: 200,
      body: { status: 'saved', default: 'default', hunt: { minScore: 0.5, maxResults: 50 } },
    });
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
    ['POST', '/api/config/reset', '{}'],
    ['POST', '/api/tailor', '{}'],
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
