import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  BatchTailorRequestSchema,
  HuntRunInboxRequestSchema,
  InboxPromoteRequestSchema,
  ManualPageInboxRequestSchema,
  PingRequestSchema,
  QuickFillRequestSchema,
  QuickTailorRequestSchema,
  RegenerateArtifactRequestSchema,
  type RuntimeStatusResponse,
  type PingResponse,
} from '../protocol.js';
import type { InboxApplicationService } from '../../application/inboxApplicationService.js';
import type { InboxPromotionApplicationService } from '../../application/inboxPromotionApplicationService.js';
import type { RunStatusApplicationService } from '../../application/runStatusApplicationService.js';
import type { HttpServer } from '../httpServer.js';

export interface NodeHttpServerOptions {
  version: string;
  workspacePath?: string;
  inboxApp: InboxApplicationService;
  inboxPromotionApp?: InboxPromotionApplicationService;
  runStatusApp?: RunStatusApplicationService;
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
      workspacePath: this.opts.workspacePath,
      body: await readRequestBody(req),
      inboxApp: this.opts.inboxApp,
      inboxPromotionApp: this.opts.inboxPromotionApp,
      runStatusApp: this.opts.runStatusApp,
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
  runStatusApp?: RunStatusApplicationService;
  workspacePath?: string;
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

  if (input.method === 'GET' && url.pathname === '/api/runtime/status') {
    const body: RuntimeStatusResponse = {
      version: input.version,
      workspacePath: input.workspacePath ?? '',
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
        quickTailor: false,
        batchTailor: false,
        quickFill: false,
      },
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

  if (
    input.method === 'POST' &&
    (url.pathname === '/api/inbox/process' || url.pathname === '/api/inbox/promote')
  ) {
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

  if (input.method === 'GET' && /^\/api\/jobs\/[^/]+\/artifacts$/.test(url.pathname)) {
    const jobId = decodeURIComponent(url.pathname.split('/')[3] ?? '');
    return {
      status: 501,
      body: {
        status: 'todo',
        todo: 'Artifact readiness is not implemented yet.',
        nextStep: 'Add artifact readiness to TailorApplicationService or a dedicated ArtifactApplicationService.',
        jobId,
        resume: { status: 'not_ready', url: null },
        coverLetter: { status: 'not_ready', url: null },
      },
    };
  }

  if (input.method === 'GET' && /^\/api\/runs\/[^/]+$/.test(url.pathname)) {
    if (!input.runStatusApp) {
      return todoRoute(input.method, url.pathname);
    }
    const runId = decodeURIComponent(url.pathname.split('/')[3] ?? '');
    const result = await input.runStatusApp.getRunStatus(runId);
    return { status: result.status === 'todo' ? 501 : 200, body: result };
  }

  const validationResult = validateTodoRequest(input.method, url.pathname, input.body);
  if (validationResult) return validationResult;

  if (isCommandSurfaceStub(input.method, url.pathname)) {
    return todoRoute(input.method, url.pathname);
  }

  return { status: 404, body: { error: 'not found' } };
}

function validateTodoRequest(method: string, pathname: string, body?: string): HttpRouteResult | null {
  const validators = [
    {
      matches: method === 'POST' && pathname === '/api/tailor/quick',
      schema: QuickTailorRequestSchema,
      error: 'invalid quick tailor request',
    },
    {
      matches: method === 'POST' && pathname === '/api/tailor/batch',
      schema: BatchTailorRequestSchema,
      error: 'invalid batch tailor request',
    },
    {
      matches: method === 'POST' && pathname === '/api/artifacts/regenerate',
      schema: RegenerateArtifactRequestSchema,
      error: 'invalid artifact regenerate request',
    },
    {
      matches: method === 'POST' && pathname === '/api/fill/quick',
      schema: QuickFillRequestSchema,
      error: 'invalid quick fill request',
    },
  ];
  const validator = validators.find((candidate) => candidate.matches);
  if (!validator) return null;

  const parsedJson = parseJsonBody(body);
  if (!parsedJson.ok) return parsedJson.result;
  const parsed = validator.schema.safeParse(parsedJson.value);
  if (!parsed.success) return { status: 400, body: { error: validator.error } };
  return null;
}

function isCommandSurfaceStub(method: string, pathname: string): boolean {
  return Boolean(todoRouteSpec(method, pathname));
}

function todoRoute(method: string, pathname: string): HttpRouteResult {
  const spec = todoRouteSpec(method, pathname);
  return {
    status: 501,
    body: {
      status: 'todo',
      todo: spec?.todo ?? `Route ${method} ${pathname} is not implemented yet.`,
      nextStep: spec?.nextStep ?? 'Add an application service method and wire it in src/serve/impl/nodeHttpServerImpl.ts.',
    },
  };
}

function todoRouteSpec(method: string, pathname: string): { todo: string; nextStep: string } | null {
  const specs = [
    {
      matches: method === 'POST' && pathname === '/api/browser/open',
      todo: 'Wolf-controlled browser launch is not implemented yet.',
      nextStep: 'Add a serve browser manager and call it from POST /api/browser/open.',
    },
    {
      matches: method === 'GET' && pathname === '/api/tabs',
      todo: 'Wolf browser tab registry is not implemented yet.',
      nextStep: 'Add a tab registry for the wolf-controlled browser instance.',
    },
    {
      matches: method === 'POST' && /^\/api\/tabs\/[^/]+\/focus$/.test(pathname),
      todo: 'Wolf browser tab focus is not implemented yet.',
      nextStep: 'Wire tab focusing through the serve browser manager.',
    },
    {
      matches: method === 'GET' && pathname === '/api/runs',
      todo: 'Run listing is not implemented yet.',
      nextStep: 'Add RunStatusApplicationService and expose run summaries.',
    },
    {
      matches: method === 'GET' && /^\/api\/runs\/[^/]+$/.test(pathname),
      todo: 'Run polling is not implemented yet.',
      nextStep: 'Add RunStatusApplicationService.getRunStatus(runId).',
    },
    {
      matches: method === 'GET' && pathname === '/api/jobs',
      todo: 'HTTP job listing is not implemented yet.',
      nextStep: 'Expose JobApplicationService list/search through GET /api/jobs.',
    },
    {
      matches: method === 'GET' && /^\/api\/jobs\/[^/]+$/.test(pathname),
      todo: 'HTTP job detail is not implemented yet.',
      nextStep: 'Expose JobApplicationService detail through GET /api/jobs/:jobId.',
    },
    {
      matches: method === 'GET' && /^\/api\/jobs\/[^/]+\/artifacts\/resume$/.test(pathname),
      todo: 'Resume artifact preview is not implemented yet.',
      nextStep: 'Expose generated resume artifacts through a serve preview route.',
    },
    {
      matches: method === 'GET' && /^\/api\/jobs\/[^/]+\/artifacts\/cover-letter$/.test(pathname),
      todo: 'Cover letter artifact preview is not implemented yet.',
      nextStep: 'Expose generated cover letter artifacts through a serve preview route.',
    },
    {
      matches: method === 'POST' && pathname === '/api/tailor/quick',
      // TODO(companion-tailor): Thread userPrompt into the existing tailor prompts.
      // Reason: companion quick tailor collects one-shot user instructions, but the
      // current service contract only supports the analyst hint flow. Keeping the
      // TODO here prevents the extension from inventing writer prompt behavior.
      todo: 'Quick tailor is not implemented yet.',
      nextStep: 'Thread companion userPrompt into TailorApplicationService and create a quick run.',
    },
    {
      matches: method === 'POST' && pathname === '/api/tailor/batch',
      todo: 'Batch tailor is not implemented yet.',
      nextStep: 'Create background AI batch rows for tailor runs.',
    },
    {
      matches: method === 'POST' && pathname === '/api/artifacts/regenerate',
      // TODO(companion-regenerate): Add a focused rewrite prompt that receives the
      // existing artifact plus one-shot user instructions.
      // Reason: regeneration is intentionally not memory-backed. The service must
      // tell users to include all desired edits in one request.
      todo: 'Artifact regeneration is not implemented yet.',
      nextStep: 'Add artifact text readback and a focused regenerate prompt.',
    },
    {
      matches: method === 'POST' && pathname === '/api/fill/quick',
      // TODO(companion-fill): Thread userPrompt into the quick fill plan before
      // Stagehand execution.
      // Reason: page-specific instructions must stay no-auto-submit and run only
      // inside the wolf browser instance.
      todo: 'Quick autofill is not implemented yet.',
      nextStep: 'Wire quick fill through Stagehand in the wolf-controlled browser instance.',
    },
    {
      matches: method === 'GET' && pathname === '/api/config',
      todo: 'HTTP config read is not implemented yet.',
      nextStep: 'Expose ConfigApplicationService through GET /api/config.',
    },
    {
      matches: method === 'POST' && pathname === '/api/config',
      todo: 'HTTP config write is not implemented yet.',
      nextStep: 'Expose ConfigApplicationService through POST /api/config.',
    },
    {
      matches: method === 'GET' && pathname === '/api/status',
      todo: 'HTTP status summary is not implemented yet.',
      nextStep: 'Expose StatusApplicationService through GET /api/status.',
    },
    {
      matches: method === 'GET' && pathname === '/api/profile',
      todo: 'HTTP profile read is not implemented yet.',
      nextStep: 'Expose ProfileApplicationService through GET /api/profile.',
    },
    {
      matches: method === 'POST' && ['/api/tailor', '/api/score', '/api/fill'].includes(pathname),
      todo: `Legacy command route ${pathname} is not implemented yet.`,
      nextStep: 'Use the newer companion-specific route or wire the legacy command route deliberately.',
    },
  ];
  return specs.find((spec) => spec.matches) ?? null;
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
