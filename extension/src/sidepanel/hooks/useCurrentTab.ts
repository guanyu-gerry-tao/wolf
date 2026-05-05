import { useCallback, useEffect } from 'react';
import { useCompanionState } from '../state/StateContext';
import { hasChromeApi, getChromeApi } from '../utils';

/**
 * Tracks the active Chrome tab. In real extension mode, listens to
 * chrome.tabs.onActivated + onUpdated. In demo mode (plain web), reads
 * document.title + location.href once.
 *
 * Exposes a `refresh` callback so other hooks can re-trigger the tab read
 * after an action (e.g., after import we want to re-check duplicate status).
 */
export function useCurrentTab() {
  const { dispatch } = useCompanionState();

  const refresh = useCallback(async () => {
    if (!hasChromeApi()) {
      dispatch({
        type: 'set-current-tab',
        tab: {
          title: document.title,
          url: location.href,
          id: null,
          windowId: null,
        },
      });
      return;
    }
    const chromeApi = getChromeApi()!;
    const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      dispatch({ type: 'set-current-tab', tab: null });
      return;
    }
    dispatch({
      type: 'set-current-tab',
      tab: {
        title: tab.title ?? '',
        url: tab.url ?? '',
        id: tab.id ?? null,
        windowId: tab.windowId ?? null,
      },
    });
  }, [dispatch]);

  // Initial read + listeners (chrome only). The mount-time call seeds state
  // for the very first render, after which listeners take over.
  useEffect(() => {
    void refresh();

    if (!hasChromeApi()) return;
    const chromeApi = getChromeApi()!;

    const handleActivated = () => {
      void refresh();
    };
    const handleUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
    ) => {
      if (changeInfo.status === 'complete') void refresh();
    };

    chromeApi.tabs.onActivated.addListener(handleActivated);
    chromeApi.tabs.onUpdated.addListener(handleUpdated);
    return () => {
      chromeApi.tabs.onActivated.removeListener(handleActivated);
      chromeApi.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, [refresh]);

  return { refresh };
}
