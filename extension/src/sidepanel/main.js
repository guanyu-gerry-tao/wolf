const chromeApi = globalThis.chrome;
const hasChromeApi = Boolean(chromeApi?.runtime?.id);
const DEFAULT_DAEMON_PORT = '47823';
const HEARTBEAT_MS = 5_000;
const IMPORT_PAGE_LABEL = 'Import Page';
const AGGREGATOR_PLATFORMS = [
  {
    name: 'LinkedIn',
    matches: (url) => hostnameEndsWith(url.hostname, 'linkedin.com') && url.pathname.includes('/jobs/'),
  },
  {
    name: 'Handshake',
    matches: (url) => hostnameEndsWith(url.hostname, 'joinhandshake.com') &&
      (url.pathname.includes('/job-search') || url.pathname.includes('/jobs/')),
  },
  {
    name: 'Indeed',
    matches: (url) => hostnameEndsWith(url.hostname, 'indeed.com') &&
      (url.pathname.includes('/viewjob') || url.pathname.includes('/jobs')),
  },
  {
    name: 'Glassdoor',
    matches: (url) => hostnameEndsWith(url.hostname, 'glassdoor.com') &&
      (url.pathname.toLowerCase().includes('/job') || url.searchParams.has('jl')),
  },
];

const state = {
  port: DEFAULT_DAEMON_PORT,
  connection: { status: 'idle', detail: 'Waiting for local wolf serve.' },
  currentTab: null,
  currentPageStatus: { kind: 'normal', detail: null },
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
  duplicateNotice: document.querySelector('#duplicateNotice'),
  importCurrentPageButton: document.querySelector('#importCurrentPageButton'),
  promoteInboxButton: document.querySelector('#promoteInboxButton'),
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

let pageStatusRequestSeq = 0;

await loadStoredPort();
wireEvents();
renderAll();
startHeartbeat();
await refreshCurrentTab();

function daemonBase() {
  return `http://127.0.0.1:${state.port}`;
}

async function loadStoredPort() {
  if (hasChromeApi) {
    const stored = await chromeApi.storage.local.get('wolfServePort');
    state.port = normalizeStoredPort(stored.wolfServePort);
    await chromeApi.storage.local.set({ wolfServePort: state.port });
  } else {
    state.port = normalizeStoredPort(localStorage.getItem('wolfServePort'));
    localStorage.setItem('wolfServePort', state.port);
  }
  els.portInput.value = state.port;
}

function normalizeStoredPort(port) {
  if (!port) return DEFAULT_DAEMON_PORT;
  return port;
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
  els.promoteInboxButton.addEventListener('click', promoteInboxWithAi);
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
    const body = await pingDaemon(nonce);
    setConnection('connected', `Connected: wolf ${body.version ?? 'unknown'}`);
    await refreshCurrentPageStatus();
  } catch (err) {
    setConnection('disconnected', err instanceof Error ? err.message : String(err));
  }
}

async function pingDaemon(nonce = Math.random().toString(36).slice(2)) {
  const res = await fetchWithTimeout(`${daemonBase()}/api/ping?nonce=${encodeURIComponent(nonce)}`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.nonce !== nonce) throw new Error('nonce mismatch');
  return body;
}

function startHeartbeat() {
  setInterval(() => {
    if (state.connection.status !== 'connected') return;
    pingDaemon().catch(() => {
      setConnection('disconnected', 'Lost connection to wolf serve.');
    });
  }, HEARTBEAT_MS);
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
  renderDaemonActionState();
  renderCurrentPageStatus();
}

function renderDaemonActionState() {
  const connected = state.connection.status === 'connected';
  const title = connected ? '' : 'Connect to wolf serve first.';
  for (const button of daemonActionButtons()) {
    button.disabled = !connected;
    button.title = title;
  }
}

function daemonActionButtons() {
  return [
    els.importCurrentPageButton,
    els.promoteInboxButton,
    els.previewResumeButton,
    els.previewCoverLetterButton,
  ];
}

function renderCurrentTab() {
  if (!state.currentTab) {
    els.currentTabLabel.textContent = hasChromeApi ? 'Reading...' : 'Demo mode';
    setCurrentPageStatus({ kind: 'normal', detail: null });
    return;
  }
  const title = state.currentTab.title || 'Current tab';
  const url = state.currentTab.url ? ` - ${state.currentTab.url}` : '';
  els.currentTabLabel.textContent = `${title}${url}`;
}

function renderCurrentPageStatus() {
  els.importCurrentPageButton.classList.remove('button-success', 'button-warning');
  els.duplicateNotice.hidden = true;
  els.duplicateNotice.className = 'page-notice';
  els.duplicateNotice.textContent = '';

  if (state.connection.status !== 'connected') {
    els.importCurrentPageButton.textContent = IMPORT_PAGE_LABEL;
    return;
  }

  if (state.currentPageStatus.kind === 'duplicate') {
    els.importCurrentPageButton.classList.add('button-success');
    els.importCurrentPageButton.textContent = 'Already Imported';
    els.duplicateNotice.hidden = false;
    els.duplicateNotice.classList.add('page-notice--success');
    renderDuplicateNotice(state.currentPageStatus.detail);
    return;
  }

  if (state.currentPageStatus.kind === 'aggregator') {
    els.importCurrentPageButton.classList.add('button-warning');
    els.importCurrentPageButton.textContent = IMPORT_PAGE_LABEL;
    els.duplicateNotice.hidden = false;
    els.duplicateNotice.classList.add('page-notice--warning');
    els.duplicateNotice.textContent = state.currentPageStatus.detail;
    return;
  }

  if (!els.importCurrentPageButton.disabled) {
    els.importCurrentPageButton.textContent = IMPORT_PAGE_LABEL;
  }
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
  await refreshCurrentPageStatus();
}

async function refreshCurrentPageStatus() {
  const requestId = ++pageStatusRequestSeq;
  const currentUrl = state.currentTab?.url;
  if (!currentUrl || state.connection.status !== 'connected') {
    setCurrentPageStatus({ kind: 'normal', detail: null });
    return;
  }

  const aggregator = detectAggregatorPlatform(currentUrl);
  try {
    const res = await fetchWithTimeout(
      `${daemonBase()}/api/inbox/duplicate-check?url=${encodeURIComponent(currentUrl)}`,
      { method: 'GET' },
    );
    if (requestId !== pageStatusRequestSeq) return;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    if (result.duplicate) {
      setCurrentPageStatus({
        kind: 'duplicate',
        detail: {
          title: result.title ?? 'Untitled page',
          url: result.url ?? currentUrl,
        },
      });
      return;
    }
  } catch (err) {
    if (requestId !== pageStatusRequestSeq) return;
    log(`Duplicate check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (aggregator) {
    setCurrentPageStatus({
      kind: 'aggregator',
      detail: `This looks like a ${aggregator.name} listing. If possible, open the company application page and import that page instead.`,
    });
    return;
  }

  setCurrentPageStatus({ kind: 'normal', detail: null });
}

function setCurrentPageStatus(nextStatus) {
  state.currentPageStatus = nextStatus;
  renderCurrentPageStatus();
}

function renderDuplicateNotice(detail) {
  const title = typeof detail?.title === 'string' ? detail.title : 'Untitled page';
  const url = typeof detail?.url === 'string' ? detail.url : state.currentTab?.url;
  els.duplicateNotice.textContent = 'Already imported. Please check ';

  if (!url) {
    els.duplicateNotice.append(title);
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.textContent = title;
  link.title = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  els.duplicateNotice.append(link);
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
  if (!ensureConnected()) return;
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
  if (!ensureConnected()) return;
  if (state.currentPageStatus.kind === 'duplicate') {
    log(state.currentPageStatus.detail ?? 'Duplicate page detected. Import skipped.');
    return;
  }
  if (state.currentPageStatus.kind === 'aggregator') {
    log('Aggregator listing detected. Import is allowed, but the company application page is usually better.');
  }

  setButtonState(els.importCurrentPageButton, 'Importing...', true);
  try {
    const snapshot = await collectCurrentPageSnapshot();
    const result = await postJson('/api/inbox/items', {
      kind: 'manual_page',
      source: 'wolf_companion',
      ...snapshot,
    });
    const imported = result.status === 'duplicate' ? 'Already Imported' : 'Imported';
    setButtonState(els.importCurrentPageButton, imported, false);
    log(result.status === 'duplicate'
      ? `Already in wolf inbox: ${result.inboxId ?? 'existing item'}`
      : `Imported page to wolf inbox: ${result.inboxId ?? 'new item'}`);
    await refreshCurrentPageStatus();
  } catch (err) {
    const message = importErrorMessage(err);
    setButtonState(els.importCurrentPageButton, 'Import Failed', false);
    log(`Import failed: ${message}`);
  } finally {
    resetImportButtonLater();
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

  await requestTabPermission(state.currentTab.url);

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

async function requestTabPermission(url) {
  const originPattern = hostPermissionPattern(url);
  if (!originPattern) {
    throw new Error('Cannot import this tab. Open an http/https page and try again.');
  }

  const granted = await chromeApi.permissions.request({ origins: [originPattern] });
  if (!granted) {
    throw new Error(`Site access was not granted for ${originPattern}`);
  }
}

function hostPermissionPattern(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.protocol}//${parsed.host}/*`;
  } catch {
    return null;
  }
}

function importErrorMessage(err) {
  const message = err instanceof Error ? err.message : String(err);
  const runtimeMessage = chromeApi?.runtime?.lastError?.message;
  if (message.includes('Cannot access contents of url')) {
    return `Cannot import this tab after site access was granted. Chrome said: ${message}`;
  }
  if (runtimeMessage) return `${message} Chrome runtime said: ${runtimeMessage}`;
  return message;
}

async function promoteInboxWithAi() {
  if (!ensureConnected()) return;
  const confirmed = window.confirm(
    'Promote raw inbox items with AI? This may use paid batch API calls.',
  );
  if (!confirmed) {
    log('AI promote cancelled.');
    return;
  }

  setButtonState(els.promoteInboxButton, 'Queueing...', true);
  try {
    const result = await postJson('/api/inbox/promote', { limit: 20, shardSize: 20 });
    if (result.status === 'empty') {
      setButtonState(els.promoteInboxButton, 'Nothing to Promote', false);
      log('No raw inbox items to promote.');
      return;
    }
    setButtonState(els.promoteInboxButton, 'Queued', false);
    log(`AI promote queued: ${result.itemCount ?? 0} item(s), ${result.shardCount ?? 0} shard(s).`);
  } catch (err) {
    setButtonState(els.promoteInboxButton, 'Queue Failed', false);
    setConnection('disconnected', err instanceof Error ? err.message : String(err));
  } finally {
    resetButtonLabelLater(els.promoteInboxButton, 'Promote with AI');
  }
}

function ensureConnected() {
  if (state.connection.status === 'connected') return true;
  log('Connect to wolf serve first.');
  return false;
}

function setButtonState(button, label, disabled) {
  button.textContent = label;
  button.disabled = disabled;
}

function resetButtonLabelLater(button, label) {
  setTimeout(() => {
    button.textContent = label;
    button.disabled = false;
  }, 1_800);
}

function resetImportButtonLater() {
  setTimeout(() => {
    els.importCurrentPageButton.disabled = false;
    renderDaemonActionState();
    renderCurrentPageStatus();
  }, 1_800);
}

async function postJson(path, body) {
  const res = await fetchWithTimeout(`${daemonBase()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`);
  }
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

function detectAggregatorPlatform(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return AGGREGATOR_PLATFORMS.find((platform) => platform.matches(url)) ?? null;
  } catch {
    return null;
  }
}

function hostnameEndsWith(hostname, suffix) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}
