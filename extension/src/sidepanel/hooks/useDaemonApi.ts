import { useCallback, useMemo } from 'react';
import { FETCH_TIMEOUT_MS } from '../utils';

interface DaemonApi {
  /** Builds the local daemon base URL from the currently selected port. */
  base: () => string;
  /** Pings the daemon and verifies the nonce so stale or impostor responses are rejected. */
  ping: (nonce?: string) => Promise<DaemonPingResponse>;
  /** GET wrapped with timeout + TODO-route handling. */
  getJson: <T = unknown>(path: string) => Promise<T>;
  /** POST wrapped with timeout + TODO-route handling. */
  postJson: <T = unknown>(path: string, body: unknown) => Promise<T>;
  /** DELETE wrapped with timeout + TODO-route handling. */
  deleteJson: <T = unknown>(path: string) => Promise<T>;
  /** Raw fetch with the standard 2.5s timeout. Used when callers need the Response. */
  fetchWithTimeout: (path: string, options?: RequestInit) => Promise<Response>;
}

interface DaemonPingResponse {
  nonce: string;
  serverTime?: string;
  version?: string;
}

/**
 * Wraps fetch calls to the local wolf serve daemon. Centralizes timeout,
 * abort handling, and the convention that 5xx responses with `{status:'todo'}`
 * are passed back as normal payloads instead of thrown errors.
 */
export function useDaemonApi(port: string): DaemonApi {
  const base = useCallback(() => `http://127.0.0.1:${port}`, [port]);

  const fetchWithTimeout = useCallback(async (path: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const url = path.startsWith('http') ? path : `${base()}${path}`;
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }, [base]);

  const handleJson = useCallback(async (res: Response): Promise<unknown> => {
    const parsed = await res.json().catch(() => null) as { status?: string; error?: string; todo?: string } | null;
    if (!res.ok) {
      // TODO routes return 5xx with a body shaped like { status: 'todo', todo: '...' }.
      // Surface them as a normal value so callers can render the explanatory text.
      if (parsed?.status === 'todo') return parsed;
      throw new Error(parsed?.error ?? parsed?.todo ?? `HTTP ${res.status}`);
    }
    return parsed ?? {};
  }, []);

  const ping = useCallback(async (nonce: string = randomNonce()): Promise<DaemonPingResponse> => {
    const res = await fetchWithTimeout(`/api/ping?nonce=${encodeURIComponent(nonce)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json() as DaemonPingResponse;
    if (body.nonce !== nonce) throw new Error('nonce mismatch');
    return body;
  }, [fetchWithTimeout]);

  const getJson = useCallback(async <T,>(path: string): Promise<T> => {
    const res = await fetchWithTimeout(path);
    return await handleJson(res) as T;
  }, [fetchWithTimeout, handleJson]);

  const postJson = useCallback(async <T,>(path: string, body: unknown): Promise<T> => {
    const res = await fetchWithTimeout(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await handleJson(res) as T;
  }, [fetchWithTimeout, handleJson]);

  const deleteJson = useCallback(async <T,>(path: string): Promise<T> => {
    const res = await fetchWithTimeout(path, { method: 'DELETE' });
    return await handleJson(res) as T;
  }, [fetchWithTimeout, handleJson]);

  return useMemo<DaemonApi>(() => ({
    base,
    ping,
    getJson,
    postJson,
    deleteJson,
    fetchWithTimeout,
  }), [base, ping, getJson, postJson, deleteJson, fetchWithTimeout]);
}

function randomNonce(): string {
  return Math.random().toString(36).slice(2);
}
