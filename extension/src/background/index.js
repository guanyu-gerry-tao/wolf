const api = globalThis.chrome;

if (api?.runtime?.onInstalled) {
  api.runtime.onInstalled.addListener(async () => {
    await api.storage?.local?.set?.({ wolfServePort: '47823' });
    await api.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
  });
}

if (api?.action?.onClicked) {
  api.action.onClicked.addListener(async (tab) => {
    if (typeof tab.windowId === 'number' && api.sidePanel?.open) {
      await api.sidePanel.open({ windowId: tab.windowId });
    }
  });
}
