import { describe, expect, it } from 'vitest';
import {
  HuntRunInboxRequestSchema,
  InboxPromoteRequestSchema,
  ManualPageInboxRequestSchema,
  PingRequestSchema,
  PingResponseSchema,
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
});
