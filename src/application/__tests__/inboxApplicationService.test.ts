import { afterEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { sink } from 'pino-test';
import { InboxApplicationServiceImpl } from '../impl/inboxApplicationServiceImpl.js';
import { createSilentLogger, setDefaultLogger } from '../../utils/logger.js';
import type { InboxRepository } from '../../repository/inboxRepository.js';

// The application layer is deliberately thin: it preserves raw captures and
// delegates storage, leaving parsing/promotion to explicit paid batch flows.
describe('InboxApplicationServiceImpl', () => {
  // Some tests install a capture logger; restore the default so later tests do
  // not inherit a live stream.
  afterEach(() => setDefaultLogger(createSilentLogger()));

  // Current-page saves must not synthesize a cleaned JD, inferred company, or
  // canonical job row. They create only one raw SQLite inbox item.
  it('stores current page captures as raw manual-page inbox items', async () => {
    const repo = {
      findByRawSha256: vi.fn(async () => null),
      findManualPageByUrl: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
    } as unknown as InboxRepository;
    const app = new InboxApplicationServiceImpl(repo);

    const result = await app.saveCurrentPage({
      kind: 'manual_page',
      source: 'wolf_companion',
      title: 'Role',
      url: 'https://example.com/job',
      html: '<html></html>',
      capturedAt: '2026-05-01T00:00:00.000Z',
    });

    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'manual_page',
      source: 'wolf_companion',
      title: 'Role',
      url: 'https://example.com/job',
      rawJson: expect.stringContaining('<html></html>'),
      status: 'raw',
      jobId: null,
      receivedAt: '2026-05-01T00:00:00.000Z',
      error: null,
    }));
    expect(result).toMatchObject({ status: 'raw' });
    expect(result.inboxId).toMatch(/^manual_/);
  });

  // Operators running `wolf serve` should see a clear event when raw HTML is
  // received, instead of having to infer success only from curl output.
  it('logs an info event when a manual page enters the raw inbox', async () => {
    const stream = sink();
    setDefaultLogger(pino({ level: 'debug' }, stream));
    const events: Record<string, unknown>[] = [];
    stream.on('data', (line) => events.push(line));

    const repo = {
      findByRawSha256: vi.fn(async () => null),
      findManualPageByUrl: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
    } as unknown as InboxRepository;
    const app = new InboxApplicationServiceImpl(repo);

    await app.saveCurrentPage({
      title: 'Role',
      url: 'https://example.com/job',
      html: '<html></html>',
      capturedAt: '2026-05-01T00:00:00.000Z',
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      msg: 'inbox.item.saved',
      level: 30,
      kind: 'manual_page',
      source: 'wolf_companion',
      url: 'https://example.com/job',
      status: 'raw',
    });
  });

  // Hunt results are also raw input. A mass-hunt run should enter the same
  // queue without exploding into processed jobs at capture time.
  it('stores hunt-run captures as raw hunt-result inbox items', async () => {
    const repo = {
      findByRawSha256: vi.fn(async () => null),
      findManualPageByUrl: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
    } as unknown as InboxRepository;
    const app = new InboxApplicationServiceImpl(repo);

    const result = await app.saveHuntRun({
      kind: 'hunt_result',
      provider: 'apify-linkedin',
      receivedAt: '2026-05-01T00:00:00.000Z',
      results: [{ title: 'Role' }],
    });

    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'hunt_result',
      source: 'apify-linkedin',
      url: null,
      title: null,
      rawJson: expect.stringContaining('apify-linkedin'),
      status: 'raw',
      jobId: null,
    }));
    expect(result).toMatchObject({ status: 'raw' });
    expect(result.inboxId).toMatch(/^hunt_/);
  });

  // Duplicate raw captures should be harmless for the extension: return the
  // existing inbox id instead of surfacing a SQLite unique-constraint error.
  it('returns duplicate when the raw payload already exists', async () => {
    const repo = {
      findByRawSha256: vi.fn(async () => ({
        id: 'manual_existing',
        status: 'raw',
      })),
      findManualPageByUrl: vi.fn(),
      insert: vi.fn(),
    } as unknown as InboxRepository;
    const app = new InboxApplicationServiceImpl(repo);

    const result = await app.saveCurrentPage({
      title: 'Role',
      url: 'https://example.com/job',
      html: '<html></html>',
      capturedAt: '2026-05-01T00:00:00.000Z',
    });

    expect(repo.insert).not.toHaveBeenCalled();
    expect(result).toEqual({ inboxId: 'manual_existing', status: 'duplicate' });
  });

  // URL identity catches common double-clicks and manual-vs-hunt URL variants
  // where the DOM differs but the job detail URL is the same after normalization.
  it('returns duplicate when the normalized manual page URL already exists', async () => {
    const repo = {
      findByRawSha256: vi.fn(async () => null),
      findManualPageByUrl: vi.fn(async () => ({
        id: 'manual_existing_url',
        status: 'raw',
        title: 'Existing Role',
        url: 'https://jobs.ashbyhq.com/cohere/66c98ca3-334b-4a6a-a27c-5807b3686121',
      })),
      insert: vi.fn(),
    } as unknown as InboxRepository;
    const app = new InboxApplicationServiceImpl(repo);

    const result = await app.saveCurrentPage({
      title: 'Role',
      url: 'https://jobs.ashbyhq.com/cohere/66c98ca3-334b-4a6a-a27c-5807b3686121?utm_source=x',
      html: '<html>changed by tracking script</html>',
      capturedAt: '2026-05-01T00:00:00.000Z',
    });

    expect(repo.findManualPageByUrl).toHaveBeenCalledWith(
      'https://jobs.ashbyhq.com/cohere/66c98ca3-334b-4a6a-a27c-5807b3686121',
    );
    expect(repo.insert).not.toHaveBeenCalled();
    expect(result).toEqual({ inboxId: 'manual_existing_url', status: 'duplicate' });
  });

  // Duplicate checks run on tab switch without DOM access. They should use the
  // same normalized URL identity as the actual import path.
  it('finds duplicate manual pages by normalized URL', async () => {
    const duplicate = {
      id: 'manual_existing_url',
      status: 'raw',
      title: 'Existing Role',
      url: 'https://jobs.ashbyhq.com/cohere/66c98ca3-334b-4a6a-a27c-5807b3686121',
    };
    const repo = {
      findManualPageByUrl: vi.fn(async () => duplicate),
    } as unknown as InboxRepository;
    const app = new InboxApplicationServiceImpl(repo);

    const result = await app.findDuplicateManualPage(
      'https://jobs.ashbyhq.com/cohere/66c98ca3-334b-4a6a-a27c-5807b3686121?utm_source=x',
    );

    expect(repo.findManualPageByUrl).toHaveBeenCalledWith(
      'https://jobs.ashbyhq.com/cohere/66c98ca3-334b-4a6a-a27c-5807b3686121',
    );
    expect(result).toBe(duplicate);
  });
});
