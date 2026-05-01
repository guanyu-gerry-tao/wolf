import { createHash, randomUUID } from 'node:crypto';
import type { InboxItem, InboxRepository } from '../../repository/inboxRepository.js';
import type {
  HuntRunInboxCapture,
  InboxSaveResult,
  ManualPageInboxCapture,
} from '../../utils/types/inbox.js';
import { log } from '../../utils/logger.js';
import type { InboxApplicationService } from '../inboxApplicationService.js';

export class InboxApplicationServiceImpl implements InboxApplicationService {
  constructor(private readonly inboxRepository: InboxRepository) {}

  async findDuplicateManualPage(url: string): Promise<InboxItem | null> {
    return this.inboxRepository.findManualPageByUrl(normalizeInboxUrl(url));
  }

  async saveCurrentPage(input: ManualPageInboxCapture): Promise<InboxSaveResult> {
    const rawJson = stableJsonStringify({
      kind: 'manual_page',
      source: input.source ?? 'wolf_companion',
      title: input.title,
      url: input.url,
      html: input.html,
      capturedAt: input.capturedAt,
    });
    const now = new Date().toISOString();
    const inboxId = `manual_${randomUUID()}`;
    const rawSha256 = sha256(rawJson);
    const existing = await this.inboxRepository.findByRawSha256(rawSha256);
    if (existing) {
      log.info('inbox.item.duplicate', {
        inboxId: existing.id,
        kind: 'manual_page',
        source: input.source ?? 'wolf_companion',
        url: input.url,
        status: 'duplicate',
      });
      return { inboxId: existing.id, status: 'duplicate' };
    }
    const normalizedUrl = normalizeInboxUrl(input.url);
    const existingUrl = await this.inboxRepository.findManualPageByUrl(normalizedUrl);
    if (existingUrl) {
      log.info('inbox.item.duplicate', {
        inboxId: existingUrl.id,
        kind: 'manual_page',
        source: input.source ?? 'wolf_companion',
        url: normalizedUrl,
        status: 'duplicate',
      });
      return { inboxId: existingUrl.id, status: 'duplicate' };
    }

    await this.inboxRepository.insert({
      id: inboxId,
      kind: 'manual_page',
      source: input.source ?? 'wolf_companion',
      url: normalizedUrl,
      title: input.title ?? null,
      rawJson,
      rawSha256,
      status: 'raw',
      jobId: null,
      receivedAt: input.capturedAt,
      updatedAt: now,
      error: null,
    });

    log.info('inbox.item.saved', {
      inboxId,
      kind: 'manual_page',
      source: input.source ?? 'wolf_companion',
      url: normalizedUrl,
      title: input.title ?? null,
      status: 'raw',
    });

    return { inboxId, status: 'raw' };
  }

  async saveHuntRun(input: HuntRunInboxCapture): Promise<InboxSaveResult> {
    const rawJson = stableJsonStringify({
      kind: 'hunt_result',
      source: input.provider,
      provider: input.provider,
      receivedAt: input.receivedAt,
      results: input.results,
    });
    const now = new Date().toISOString();
    const inboxId = `hunt_${randomUUID()}`;
    const rawSha256 = sha256(rawJson);
    const existing = await this.inboxRepository.findByRawSha256(rawSha256);
    if (existing) {
      log.info('inbox.item.duplicate', {
        inboxId: existing.id,
        kind: 'hunt_result',
        source: input.provider,
        status: 'duplicate',
      });
      return { inboxId: existing.id, status: 'duplicate' };
    }

    await this.inboxRepository.insert({
      id: inboxId,
      kind: 'hunt_result',
      source: input.provider,
      url: null,
      title: null,
      rawJson,
      rawSha256,
      status: 'raw',
      jobId: null,
      receivedAt: input.receivedAt,
      updatedAt: now,
      error: null,
    });

    log.info('inbox.item.saved', {
      inboxId,
      kind: 'hunt_result',
      source: input.provider,
      status: 'raw',
    });

    return { inboxId, status: 'raw' };
  }
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function normalizeInboxUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (!isIdentityQueryParam(key)) parsed.searchParams.delete(key);
    }
    parsed.searchParams.sort();
    const path = parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/g, '') : parsed.pathname;
    parsed.pathname = path || '/';
    return parsed.toString();
  } catch {
    return url;
  }
}

function isIdentityQueryParam(key: string): boolean {
  return [
    'currentJobId',
    'gh_jid',
    'id',
    'jk',
    'job_id',
    'jobId',
    'reqId',
    'requisitionId',
  ].includes(key);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const nested = (value as Record<string, unknown>)[key];
    if (nested !== undefined) sorted[key] = sortJson(nested);
  }
  return sorted;
}
