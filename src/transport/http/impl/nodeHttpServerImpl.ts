import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  HuntRunInboxRequestSchema,
  InboxPromoteRequestSchema,
  ManualPageInboxRequestSchema,
  PingRequestSchema,
  type PingResponse,
} from '../../../shared/protocol.js';
import type { InboxApplicationService } from '../../../application/inboxApplicationService.js';
import type { InboxPromotionApplicationService } from '../../../application/inboxPromotionApplicationService.js';
import type { HttpServer } from '../httpServer.js';

export interface NodeHttpServerOptions {
  version: string;
  inboxApp: InboxApplicationService;
  inboxPromotionApp?: InboxPromotionApplicationService;
}

export interface HttpRouteResult {
  status: number;
  body: unknown;
}

export class NodeHttpServerImpl implements HttpServer {
  private server: http.Server | null = null;

  constructor(private readonly opts: NodeHttpServerOptions) {}

  async start(port: number): Promise<void> {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        writeJson(res, 500, { error: message });
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(port, '127.0.0.1', () => {
        this.server!.off('error', reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    this.server = null;

    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  address(): AddressInfo {
    if (!this.server) throw new Error('HTTP server has not started');
    const address = this.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('HTTP server address is unavailable');
    }
    return address;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method === 'OPTIONS') {
      writeCors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    const result = await dispatchHttpRequest({
      method: req.method ?? 'GET',
      url: req.url ?? '/',
      version: this.opts.version,
      body: await readRequestBody(req),
      inboxApp: this.opts.inboxApp,
      inboxPromotionApp: this.opts.inboxPromotionApp,
    });
    writeJson(res, result.status, result.body);
  }
}

export async function dispatchHttpRequest(input: {
  method: string;
  url: string;
  version: string;
  body?: string;
  inboxApp?: InboxApplicationService;
  inboxPromotionApp?: InboxPromotionApplicationService;
}): Promise<HttpRouteResult> {
  const url = new URL(input.url, 'http://127.0.0.1');
  if (input.method === 'GET' && url.pathname === '/api/ping') {
    const parsed = PingRequestSchema.safeParse({
      nonce: url.searchParams.get('nonce') ?? undefined,
    });
    if (!parsed.success) {
      return { status: 400, body: { error: 'missing nonce' } };
    }

    const body: PingResponse = {
      nonce: parsed.data.nonce,
      serverTime: new Date().toISOString(),
      version: input.version,
    };
    return { status: 200, body };
  }

  if (input.method === 'GET' && url.pathname === '/api/inbox/duplicate-check') {
    if (!input.inboxApp) {
      return { status: 503, body: { error: 'inbox unavailable' } };
    }
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return { status: 400, body: { error: 'missing url' } };
    }
    const duplicate = await input.inboxApp.findDuplicateManualPage(targetUrl);
    if (!duplicate) {
      return { status: 200, body: { duplicate: false } };
    }
    return {
      status: 200,
      body: {
        duplicate: true,
        inboxId: duplicate.id,
        title: duplicate.title,
        url: duplicate.url,
        receivedAt: duplicate.receivedAt,
        status: duplicate.status,
      },
    };
  }

  if (
    input.method === 'POST' &&
    (url.pathname === '/api/inbox/items' || url.pathname === '/api/inbox/current-page')
  ) {
    if (!input.inboxApp) {
      return { status: 503, body: { error: 'inbox unavailable' } };
    }
    const parsedJson = parseJsonBody(input.body);
    if (!parsedJson.ok) return parsedJson.result;

    const parsed = ManualPageInboxRequestSchema.safeParse(parsedJson.value);
    if (!parsed.success) {
      return { status: 400, body: { error: 'invalid current page inbox request' } };
    }

    const result = await input.inboxApp.saveCurrentPage(parsed.data);
    return { status: 201, body: result };
  }

  if (input.method === 'POST' && url.pathname === '/api/inbox/hunt-run') {
    if (!input.inboxApp) {
      return { status: 503, body: { error: 'inbox unavailable' } };
    }
    const parsedJson = parseJsonBody(input.body);
    if (!parsedJson.ok) return parsedJson.result;

    const parsed = HuntRunInboxRequestSchema.safeParse(parsedJson.value);
    if (!parsed.success) {
      return { status: 400, body: { error: 'invalid hunt run inbox request' } };
    }

    const result = await input.inboxApp.saveHuntRun(parsed.data);
    return { status: 201, body: result };
  }

  if (input.method === 'POST' && url.pathname === '/api/inbox/promote') {
    if (!input.inboxPromotionApp) {
      return { status: 503, body: { error: 'inbox promotion unavailable' } };
    }
    const parsedJson = parseJsonBody(input.body);
    if (!parsedJson.ok) return parsedJson.result;

    const parsed = InboxPromoteRequestSchema.safeParse(parsedJson.value);
    if (!parsed.success) {
      return { status: 400, body: { error: 'invalid inbox promote request' } };
    }

    const result = await input.inboxPromotionApp.promoteRawInbox(parsed.data);
    return { status: 202, body: result };
  }

  if (isCommandSurfaceStub(input.method, url.pathname)) {
    return { status: 501, body: { error: 'not implemented' } };
  }

  return { status: 404, body: { error: 'not found' } };
}

function isCommandSurfaceStub(method: string, pathname: string): boolean {
  if (method === 'GET' && pathname === '/api/jobs') return true;
  if (method === 'GET' && /^\/api\/jobs\/[^/]+$/.test(pathname)) return true;
  if (method === 'GET' && pathname === '/api/status') return true;
  if (method === 'GET' && pathname === '/api/profile') return true;
  if (method === 'POST' && ['/api/tailor', '/api/score', '/api/fill'].includes(pathname)) return true;
  return false;
}

async function readRequestBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function parseJsonBody(body: string | undefined):
  | { ok: true; value: unknown }
  | { ok: false; result: HttpRouteResult } {
  try {
    return { ok: true, value: JSON.parse(body ?? '{}') };
  } catch {
    return { ok: false, result: { status: 400, body: { error: 'invalid json' } } };
  }
}

function writeCors(res: http.ServerResponse): void {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  writeCors(res);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.writeHead(status);
  res.end(JSON.stringify(body));
}
