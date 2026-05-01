import { describe, expect, it } from 'vitest';
import {
  HuntRunInboxRequestSchema,
  InboxPromoteRequestSchema,
  BatchTailorRequestSchema,
  ManualPageInboxRequestSchema,
  PingRequestSchema,
  PingResponseSchema,
  QuickFillRequestSchema,
  QuickTailorRequestSchema,
  RegenerateArtifactRequestSchema,
  RunStatusResponseSchema,
  RuntimeStatusResponseSchema,
} from '../protocol.js';

describe('HTTP companion protocol', () => {
  // Ping is the first extension-to-daemon contract. It must echo the nonce so
  // the extension can distinguish a fresh daemon response from stale traffic.
  it('parses a ping request and response', () => {
    const request = PingRequestSchema.parse({ nonce: 'abc123' });
    expect(request.nonce).toBe('abc123');

    const response = PingResponseSchema.parse({
      nonce: request.nonce,
      serverTime: '2026-04-30T00:00:00.000Z',
      version: '0.1.0',
    });
    expect(response.nonce).toBe('abc123');
  });

  // Runtime status is the side panel's safety gate before any browser
  // automation. It must carry both machine-readable status and human action.
  it('parses runtime status for the wolf browser gate', () => {
    const response = RuntimeStatusResponseSchema.parse({
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

    expect(response.browser.status).toBe('not_started');
    expect(response.browser.requiredAction).toContain('wolf serve');
  });

  // Run status is shared by inbox processing, quick tailor, batch tailor,
  // regeneration, and fill. Ready runs may include artifact preview slots.
  it('parses shared companion run status responses', () => {
    const response = RunStatusResponseSchema.parse({
      runId: 'run-1',
      status: 'ready',
      type: 'tailor',
      itemCount: 1,
      artifacts: {
        resume: { status: 'ready', url: 'http://127.0.0.1:49152/api/jobs/job-1/artifacts/resume' },
        coverLetter: { status: 'not_ready', url: null },
      },
    });

    expect(response.status).toBe('ready');
    expect(response.artifacts?.resume.status).toBe('ready');
  });

  // The current-page route accepts only raw capture material. Extra derived
  // fields from the extension are ignored by zod rather than persisted.
  it('parses a raw manual page inbox request', () => {
    const request = ManualPageInboxRequestSchema.parse({
      title: 'Role',
      url: 'https://example.com/job',
      html: '<html></html>',
      visibleText: 'not part of inbox storage',
      capturedAt: '2026-05-01T00:00:00.000Z',
    });

    expect(request).toEqual({
      kind: 'manual_page',
      source: 'wolf_companion',
      title: 'Role',
      url: 'https://example.com/job',
      html: '<html></html>',
      capturedAt: '2026-05-01T00:00:00.000Z',
    });
  });

  // Mass-hunt input stays at run granularity: one provider run, many raw
  // result objects, no per-job filesystem fanout at capture time.
  it('parses a raw hunt-run inbox request', () => {
    const request = HuntRunInboxRequestSchema.parse({
      provider: 'apify-linkedin',
      receivedAt: '2026-05-01T00:00:00.000Z',
      results: [{ id: 'job-1' }],
    });

    expect(request.provider).toBe('apify-linkedin');
    expect(request.kind).toBe('hunt_result');
    expect(request.results).toEqual([{ id: 'job-1' }]);
  });

  // Inbox promotion is the first paid step. Limits are intentionally bounded
  // and provider shards are capped at 20 items.
  it('parses a bounded inbox promote request', () => {
    expect(InboxPromoteRequestSchema.parse({}).limit).toBe(20);
    expect(InboxPromoteRequestSchema.parse({ limit: 10, shardSize: 10 })).toMatchObject({
      limit: 10,
      shardSize: 10,
    });
    expect(() => InboxPromoteRequestSchema.parse({ limit: 0 })).toThrow();
    expect(() => InboxPromoteRequestSchema.parse({ shardSize: 21 })).toThrow();
  });

  // Prompt-powered companion actions share the same "one-shot instruction"
  // idea but still need separate request contracts for tailor, regenerate, and fill.
  it('parses prompt-powered companion action requests', () => {
    expect(QuickTailorRequestSchema.parse({
      jobId: 'job-1',
      userPrompt: 'focus on backend systems',
    })).toMatchObject({
      jobId: 'job-1',
      artifactTargets: ['resume', 'cover_letter'],
    });

    expect(BatchTailorRequestSchema.parse({
      jobIds: ['job-1', 'job-2'],
      userPrompt: 'keep leadership brief',
    }).jobIds).toHaveLength(2);

    expect(RegenerateArtifactRequestSchema.parse({
      jobId: 'job-1',
      artifactType: 'resume',
      existingArtifactText: '<section>old</section>',
      userPrompt: 'make this more concise',
    }).artifactType).toBe('resume');

    expect(QuickFillRequestSchema.parse({
      jobId: 'job-1',
      tabId: 123,
      userPrompt: 'do not answer optional demographics',
    }).tabId).toBe(123);
  });
});
