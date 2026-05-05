// Minimal mock of the wolf serve HTTP daemon. The harness boots this
// alongside Playwright and points the side panel at the random port. By
// switching the active "preset" before each scenario, the harness can
// drive the companion through every UI state without depending on real
// AI calls or the Chrome browser-controlled by stagehand.

import http from 'node:http';
import type { AddressInfo } from 'node:net';

export type PresetName =
  | 'disconnected'
  | 'connected-empty'
  | 'runtime-not-ready'
  | 'has-imports'
  | 'has-processed'
  | 'has-tailored'
  | 'run-active';

interface MockState {
  preset: PresetName;
}

interface MockResponse {
  status?: number;
  body: unknown;
}

const RUNTIME_READY = {
  browser: {
    status: 'ready',
    detail: 'Wolf browser is running.',
    requiredAction: 'Use the wolf Chrome window for application pages.',
  },
};

const RUNTIME_NOT_STARTED = {
  browser: {
    status: 'not_started',
    detail: 'Wolf browser is not running yet.',
    requiredAction: 'Click Reconnect after starting wolf serve, or call POST /api/browser/open.',
  },
};

function presetResponse(preset: PresetName, path: string): MockResponse {
  // /api/ping always succeeds; the side panel echoes the nonce.
  if (path.startsWith('/api/ping')) {
    const nonce = new URL(`http://x${path}`).searchParams.get('nonce') ?? '';
    return { body: { nonce, serverTime: new Date().toISOString(), version: 'mock-1.0' } };
  }
  if (path === '/api/runtime/status') {
    return {
      body: preset === 'runtime-not-ready' || preset === 'disconnected'
        ? RUNTIME_NOT_STARTED
        : RUNTIME_READY,
    };
  }
  if (path === '/api/inbox/status') {
    const counts: Record<PresetName, { hasRaw: boolean; rawCount: number }> = {
      disconnected: { hasRaw: false, rawCount: 0 },
      'connected-empty': { hasRaw: false, rawCount: 0 },
      'runtime-not-ready': { hasRaw: false, rawCount: 0 },
      'has-imports': { hasRaw: true, rawCount: 3 },
      'has-processed': { hasRaw: false, rawCount: 0 },
      'has-tailored': { hasRaw: false, rawCount: 0 },
      'run-active': { hasRaw: false, rawCount: 0 },
    };
    return { body: counts[preset] };
  }
  if (path === '/api/tabs') {
    const ready = preset === 'has-processed' || preset === 'has-tailored' || preset === 'run-active';
    const queues = {
      filling: [],
      ready: ready ? Array.from({ length: 3 }).map((_, i) => ({
        jobId: `job-${i + 1}`,
        title: ['Senior Backend Engineer', 'Staff Software Engineer', 'Senior Systems Engineer'][i],
        company: ['Acme', 'Initech', 'Cyberdyne'][i],
        url: `https://example.com/job/${i + 1}`,
      })) : [],
      stuck: [],
    };
    const counts = {
      untailoredJobs: preset === 'has-processed' ? 3 : preset === 'has-tailored' ? 0 : 0,
    };
    return { body: { queues, counts } };
  }
  if (path.startsWith('/api/inbox/duplicate-check')) {
    return { body: { duplicate: false } };
  }
  if (path.startsWith('/api/jobs/') && path.endsWith('/artifacts')) {
    if (preset === 'has-tailored') {
      return {
        body: {
          resume: { status: 'ready', url: 'http://localhost/mock/resume.pdf' },
          coverLetter: { status: 'ready', url: 'http://localhost/mock/cover.pdf' },
        },
      };
    }
    return {
      body: {
        resume: { status: 'not_ready', url: null },
        coverLetter: { status: 'not_ready', url: null },
      },
    };
  }
  if (path === '/api/config') {
    return {
      body: {
        default: 'default',
        hunt: { minScore: 0.5, maxResults: 50 },
        tailor: { model: 'anthropic/claude-sonnet-4-6', defaultCoverLetterTone: 'professional' },
        score: { model: 'anthropic/claude-sonnet-4-6' },
        reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
        fill: { model: 'anthropic/claude-haiku-4-5-20251001' },
      },
    };
  }
  return { status: 404, body: { error: 'mock route not found' } };
}

export interface MockServerHandle {
  port: number;
  setPreset: (preset: PresetName) => void;
  close: () => Promise<void>;
}

export async function startMockServer(initial: PresetName = 'disconnected'): Promise<MockServerHandle> {
  const state: MockState = { preset: initial };

  const server = http.createServer((req, res) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    const path = req.url ?? '/';
    const result = presetResponse(state.preset, path);
    res.statusCode = result.status ?? 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(result.body));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;

  return {
    port: address.port,
    setPreset(preset) {
      state.preset = preset;
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
