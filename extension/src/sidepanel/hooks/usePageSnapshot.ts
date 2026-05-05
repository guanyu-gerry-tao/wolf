import { useCallback } from 'react';
import { hasChromeApi, getChromeApi, hostPermissionPattern } from '../utils';

interface PageSnapshot {
  title: string;
  url: string;
  visibleText: string;
  html: string;
  capturedAt: string;
}

interface SnapshotInput {
  tabId: number | null;
  url: string;
}

/**
 * Captures the visible HTML + text from the active tab.
 *
 * In real extension mode it requests host permission for the current origin
 * (chrome.permissions.request) then runs an injected snapshot function via
 * chrome.scripting.executeScript.
 *
 * In demo mode it reads from the local `document` instead — useful when the
 * side panel is loaded as a regular web page by the harness.
 *
 * The injected function is intentionally pure: no React state, no captured
 * variables. Its return value is JSON-serialized across the messaging
 * boundary by Chrome.
 */
export function usePageSnapshot() {
  return useCallback(async (input: SnapshotInput): Promise<PageSnapshot> => {
    if (!hasChromeApi() || typeof input.tabId !== 'number') {
      return {
        title: document.title,
        url: location.href,
        visibleText: document.body?.innerText?.slice(0, 50_000) ?? '',
        html: document.documentElement.outerHTML,
        capturedAt: new Date().toISOString(),
      };
    }

    const chromeApi = getChromeApi()!;
    await requestTabPermission(chromeApi, input.url);

    const results = await chromeApi.scripting.executeScript({
      target: { tabId: input.tabId },
      func: () => ({
        title: document.title,
        url: location.href,
        visibleText: document.body?.innerText?.slice(0, 50_000) ?? '',
        html: document.documentElement.outerHTML,
        capturedAt: new Date().toISOString(),
      }),
    });
    const first = results[0];
    if (!first) {
      throw new Error('Page snapshot returned no result.');
    }
    return first.result as PageSnapshot;
  }, []);
}

async function requestTabPermission(chromeApi: typeof chrome, url: string) {
  const originPattern = hostPermissionPattern(url);
  if (!originPattern) {
    throw new Error('Cannot import this tab. Open an http/https page and try again.');
  }
  const granted = await chromeApi.permissions.request({ origins: [originPattern] });
  if (!granted) {
    throw new Error(`Site access was not granted for ${originPattern}`);
  }
}
