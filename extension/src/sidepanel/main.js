const chromeApi = globalThis.chrome;
const hasChromeApi = Boolean(chromeApi?.runtime?.id);

const state = {
  port: '47823',
  connection: { status: 'idle', detail: 'Waiting for local wolf serve.' },
  currentTab: null,
  currentJobId: 'demo-ready-1',
  cursors: { filling: 0, ready: 0, stuck: 0 },
  queues: {
    filling: [
      { id: 'demo-fill-1', title: 'Frontend Engineer', company: 'Northstar Labs', tabId: null, windowId: null },
      { id: 'demo-fill-2', title: 'AI Product Intern', company: 'Fieldnote Systems', tabId: null, windowId: null },
    ],
    ready: [
      { id: 'demo-ready-1', title: 'Software Engineer', company: 'Riverline Health', tabId: null, windowId: null },
    ],
    stuck: [
      { id: 'demo-stuck-1', title: 'Platform Engineer', company: 'Tandem Works', tabId: null, windowId: null },
    ],
  },
};

const els = {
  portInput: document.querySelector('#portInput'),
  reconnectButton: document.querySelector('#reconnectButton'),
  connectionBadge: document.querySelector('#connectionBadge'),
  connectionDetail: document.querySelector('#connectionDetail'),
  currentTabLabel: document.querySelector('#currentTabLabel'),
  importCurrentPageButton: document.querySelector('#importCurrentPageButton'),
  batchWriteButton: document.querySelector('#batchWriteButton'),
  previewResumeButton: document.querySelector('#previewResumeButton'),
  previewCoverLetterButton: document.querySelector('#previewCoverLetterButton'),
  activityLog: document.querySelector('#activityLog'),
  columns: {
    filling: {
      count: document.querySelector('#fillingCount'),
      list: document.querySelector('#fillingList'),
    },
    ready: {
      count: document.querySelector('#readyCount'),
      list: document.querySelector('#readyList'),
    },
    stuck: {
      count: document.querySelector('#stuckCount'),
      list: document.querySelector('#stuckList'),
    },
  },
};

await loadStoredPort();
wireEvents();
renderAll();
await refreshCurrentTab();

function daemonBase() {
  return `http://127.0.0.1:${state.port}`;
}

async function loadStoredPort() {
  if (hasChromeApi) {
    const stored = await chromeApi.storage.local.get('wolfServePort');
    state.port = stored.wolfServePort ?? state.port;
  } else {
    state.port = localStorage.getItem('wolfServePort') ?? state.port;
  }
  els.portInput.value = state.port;
}

async function storePort(port) {
  state.port = port;
  if (hasChromeApi) {
    await chromeApi.storage.local.set({ wolfServePort: port });
  } else {
    localStorage.setItem('wolfServePort', port);
  }
}

function wireEvents() {
  els.reconnectButton.addEventListener('click', reconnect);
  els.importCurrentPageButton.addEventListener('click', importCurrentPage);
  els.batchWriteButton.addEventListener('click', batchWriteInbox);
  els.previewResumeButton.addEventListener('click', () => openPreview('resume'));
  els.previewCoverLetterButton.addEventListener('click', () => openPreview('cover-letter'));

  document.querySelectorAll('[data-next-column]').forEach((button) => {
    button.addEventListener('click', () => focusNext(button.dataset.nextColumn));
  });

  if (hasChromeApi) {
    chromeApi.tabs.onActivated.addListener(refreshCurrentTab);
    chromeApi.tabs.onUpdated.addListener((_tabId, changeInfo) => {
      if (changeInfo.status === 'complete') refreshCurrentTab();
    });
  }
}

async function reconnect() {
  const port = els.portInput.value.trim();
  if (!/^[0-9]{4,5}$/.test(port)) {
    setConnection('disconnected', 'Port must be 4-5 digits.');
    return;
  }

  await storePort(port);
  setConnection('idle', 'Pinging wolf serve...');
  const nonce = Math.random().toString(36).slice(2);

  try {
    const res = await fetchWithTimeout(`${daemonBase()}/api/ping?nonce=${encodeURIComponent(nonce)}`, {
      method: 'GET',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body.nonce !== nonce) throw new Error('nonce mismatch');
    setConnection('connected', `Connected: wolf ${body.version ?? 'unknown'}`);
  } catch (err) {
    setConnection('disconnected', err instanceof Error ? err.message : String(err));
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_500);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function setConnection(status, detail) {
  state.connection = { status, detail };
  renderConnection();
  log(detail);
}

function renderAll() {
  renderConnection();
  renderCurrentTab();
  renderQueues();
}

function renderConnection() {
  els.connectionBadge.className = `status-badge status-badge--${state.connection.status}`;
  els.connectionBadge.textContent = {
    connected: 'Online',
    disconnected: 'Offline',
    idle: 'Idle',
  }[state.connection.status];
  els.connectionDetail.textContent = state.connection.detail;
}

function renderCurrentTab() {
  if (!state.currentTab) {
    els.currentTabLabel.textContent = hasChromeApi ? 'Reading...' : 'Demo mode';
    return;
  }
  els.currentTabLabel.textContent = state.currentTab.title || state.currentTab.url || 'Current tab';
}

function renderQueues() {
  for (const column of Object.keys(state.queues)) {
    const items = state.queues[column];
    els.columns[column].count.textContent = String(items.length);
    els.columns[column].list.replaceChildren(...items.map(renderQueueItem));
  }
}

function renderQueueItem(item) {
  const li = document.createElement('li');
  const title = document.createElement('span');
  title.className = 'job-title';
  title.textContent = item.title;
  const meta = document.createElement('span');
  meta.className = 'job-meta';
  meta.textContent = item.company;
  li.append(title, meta);
  return li;
}

async function refreshCurrentTab() {
  if (!hasChromeApi) {
    state.currentTab = {
      title: document.title,
      url: location.href,
      id: null,
      windowId: null,
    };
    renderCurrentTab();
    return;
  }

  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  state.currentTab = tab ?? null;
  renderCurrentTab();
}

async function focusNext(column) {
  const items = state.queues[column] ?? [];
  if (items.length === 0) {
    log('This column has no pages yet.');
    return;
  }

  const index = state.cursors[column] % items.length;
  state.cursors[column] += 1;
  const item = items[index];
  state.currentJobId = item.id;

  if (!hasChromeApi || typeof item.tabId !== 'number') {
    log(`Demo: ${item.company} - ${item.title}`);
    return;
  }

  if (typeof item.windowId === 'number') {
    await chrome.windows.update(item.windowId, { focused: true });
  }
  await chrome.tabs.update(item.tabId, { active: true });
  log(`Focused ${item.company} - ${item.title}`);
}

async function openPreview(kind) {
  const jobId = state.currentJobId;
  const path = kind === 'resume' ? '/api/preview/resume' : '/api/preview/cover-letter';
  const url = `${daemonBase()}${path}?jobId=${encodeURIComponent(jobId)}`;

  if (hasChromeApi) {
    await chromeApi.tabs.create({ url });
  } else {
    window.open(url, '_blank', 'noopener');
  }
  log(kind === 'resume' ? 'Opened resume preview.' : 'Opened cover letter preview.');
}

async function importCurrentPage() {
  const snapshot = await collectCurrentPageSnapshot();
  try {
    await postJson('/api/inbox/current-page', snapshot);
    log('Sent current page to wolf inbox.');
  } catch (err) {
    setConnection('disconnected', err instanceof Error ? err.message : String(err));
  }
}

async function collectCurrentPageSnapshot() {
  if (!hasChromeApi || typeof state.currentTab?.id !== 'number') {
    return {
      title: document.title,
      url: location.href,
      visibleText: document.body?.innerText?.slice(0, 50_000) ?? '',
      html: document.documentElement.outerHTML,
      capturedAt: new Date().toISOString(),
    };
  }

  const [result] = await chromeApi.scripting.executeScript({
    target: { tabId: state.currentTab.id },
    func: () => ({
      title: document.title,
      url: location.href,
      visibleText: document.body?.innerText?.slice(0, 50_000) ?? '',
      html: document.documentElement.outerHTML,
      capturedAt: new Date().toISOString(),
    }),
  });
  return result.result;
}

async function batchWriteInbox() {
  try {
    await postJson('/api/inbox/batch-write', { limit: 25 });
    log('Requested JD batch write.');
  } catch (err) {
    setConnection('disconnected', err instanceof Error ? err.message : String(err));
  }
}

async function postJson(path, body) {
  const res = await fetchWithTimeout(`${daemonBase()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => ({}));
}

function log(message) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  els.activityLog.prepend(li);
  while (els.activityLog.children.length > 6) {
    els.activityLog.lastElementChild?.remove();
  }
}
