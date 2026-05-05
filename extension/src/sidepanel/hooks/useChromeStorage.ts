import { useCallback, useEffect, useRef, useState } from 'react';
import { hasChromeApi, getChromeApi, DEFAULT_DAEMON_PORT, normalizeStoredPort } from '../utils';

/**
 * Persistent daemon port. Reads from chrome.storage.local in real extension
 * mode, or from window.localStorage when the side panel runs as a plain web
 * page (used by the visual-review harness and the static dev demo).
 *
 * Returns the current port, a setter that persists, and a `loaded` flag so
 * callers can wait for the initial read before issuing the first ping.
 */
export function usePersistedPort() {
  const [port, setPort] = useState<string>(DEFAULT_DAEMON_PORT);
  const [loaded, setLoaded] = useState(false);
  const cancelledRef = useRef(false);

  // Initial load. Runs once. The cancelledRef guard is paranoid for the
  // case where the component unmounts before chrome.storage resolves.
  useEffect(() => {
    cancelledRef.current = false;
    void loadInitialPort().then((value) => {
      if (cancelledRef.current) return;
      setPort(value);
      setLoaded(true);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const persist = useCallback(async (next: string) => {
    setPort(next);
    if (hasChromeApi()) {
      await getChromeApi()!.storage.local.set({ wolfServePort: next });
    } else {
      window.localStorage.setItem('wolfServePort', next);
    }
  }, []);

  return { port, setPort: persist, loaded };
}

async function loadInitialPort(): Promise<string> {
  if (hasChromeApi()) {
    const stored = await getChromeApi()!.storage.local.get('wolfServePort');
    const normalized = normalizeStoredPort(stored.wolfServePort);
    // Persist the normalized default so future reads are stable.
    await getChromeApi()!.storage.local.set({ wolfServePort: normalized });
    return normalized;
  }
  const normalized = normalizeStoredPort(window.localStorage.getItem('wolfServePort'));
  window.localStorage.setItem('wolfServePort', normalized);
  return normalized;
}
