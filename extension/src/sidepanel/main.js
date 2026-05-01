const chromeApi = globalThis.chrome;
const hasChromeApi = Boolean(chromeApi?.runtime?.id);
const DEFAULT_DAEMON_PORT = '47823';
const HEARTBEAT_MS = 5_000;
const RUN_POLL_MS = 5_000;
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
  runtime: {
    browser: {
      status: 'unknown',
      detail: 'Connect to wolf serve first.',
      requiredAction: 'Start wolf serve, then reconnect.',
    },
  },
  currentTab: null,
  activeWolfTabId: null,
  currentPageStatus: { kind: 'normal', detail: null },
  currentJobId: 'demo-ready-1',
  view: 'main',
  activeArtifactKind: null,
  activeRunId: null,
  runPollTimer: null,
  artifacts: {
    resume: { status: 'not_ready', url: null },
    coverLetter: { status: 'not_ready', url: null },
  },
  cursors: { filling: 0, ready: 0, stuck: 0 },
  queues: {
    filling: [],
    ready: [],
    stuck: [],
  },
};

const els = {
  configButton: document.querySelector('#configButton'),
  currentPanel: document.querySelector('#currentPanel'),
  artifactEditPanel: document.querySelector('#artifactEditPanel'),
  artifactEditTitle: document.querySelector('#artifactEditTitle'),
  artifactEditPromptInput: document.querySelector('#artifactEditPromptInput'),
  regenerateArtifactButton: document.querySelector('#regenerateArtifactButton'),
  backToCurrentButton: document.querySelector('#backToCurrentButton'),
  configPanel: document.querySelector('#configPanel'),
  closeConfigButton: document.querySelector('#closeConfigButton'),
  configPortInput: document.querySelector('#configPortInput'),
  defaultProfileInput: document.querySelector('#defaultProfileInput'),
  stagehandSessionsInput: document.querySelector('#stagehandSessionsInput'),
  browserModeInput: document.querySelector('#browserModeInput'),
  aiProviderDisplay: document.querySelector('#aiProviderDisplay'),
  saveConfigButton: document.querySelector('#saveConfigButton'),
  portInput: document.querySelector('#portInput'),
  reconnectButton: document.querySelector('#reconnectButton'),
  connectionBadge: document.querySelector('#connectionBadge'),
  connectionDetail: document.querySelector('#connectionDetail'),
  runtimeOverlay: document.querySelector('#runtimeOverlay'),
  runtimeOverlayDetail: document.querySelector('#runtimeOverlayDetail'),
  runtimeOverlayStatus: document.querySelector('#runtimeOverlayStatus'),
  openBrowserButton: document.querySelector('#openBrowserButton'),
  currentTabLabel: document.querySelector('#currentTabLabel'),
  duplicateNotice: document.querySelector('#duplicateNotice'),
  importCurrentPageButton: document.querySelector('#importCurrentPageButton'),
  processInboxButton: document.querySelector('#processInboxButton'),
  previewResumeButton: document.querySelector('#previewResumeButton'),
  previewCoverLetterButton: document.querySelector('#previewCoverLetterButton'),
  tailorInstantButton: document.querySelector('#tailorInstantButton'),
  refreshRunStatusButton: document.querySelector('#refreshRunStatusButton'),
  batchTailorButton: document.querySelector('#batchTailorButton'),
  autofillQuickButton: document.querySelector('#autofillQuickButton'),
  tailorPromptBox: document.querySelector('#tailorPromptBox'),
  tailorPromptInput: document.querySelector('#tailorPromptInput'),
  fillPromptBox: document.querySelector('#fillPromptBox'),
  fillPromptInput: document.querySelector('#fillPromptInput'),
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
  els.configButton.addEventListener('click', openConfig);
  els.openBrowserButton.addEventListener('click', openWolfBrowser);
  els.closeConfigButton.addEventListener('click', showMainView);
  els.saveConfigButton.addEventListener('click', saveConfig);
  els.backToCurrentButton.addEventListener('click', showMainView);
  els.regenerateArtifactButton.addEventListener('click', regenerateArtifact);
  els.reconnectButton.addEventListener('click', reconnect);
  els.importCurrentPageButton.addEventListener('click', importCurrentPage);
  els.processInboxButton.addEventListener('click', processInboxWithAi);
  els.previewResumeButton.addEventListener('click', () => openPreview('resume'));
  els.previewCoverLetterButton.addEventListener('click', () => openPreview('cover-letter'));
  els.tailorInstantButton.addEventListener('click', tailorThisJobInstantly);
  els.refreshRunStatusButton.addEventListener('click', refreshActiveRunOrArtifacts);
  els.batchTailorButton.addEventListener('click', batchTailor);
  els.autofillQuickButton.addEventListener('click', autofillThisPage);
  els.tailorPromptInput.addEventListener('input', renderTailorPromptState);
  els.fillPromptInput.addEventListener('input', renderFillPromptState);

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
    await refreshRuntimeStatus();
    await refreshArtifactStatus();
    await refreshQueues();
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
    pingDaemon()
      .then(() => refreshRuntimeStatus())
      .catch(() => {
        setConnection('disconnected', 'Lost connection to wolf serve.');
      });
  }, HEARTBEAT_MS);
}

async function refreshRuntimeStatus() {
  const res = await fetchWithTimeout(`${daemonBase()}/api/runtime/status`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const runtime = await res.json();
  state.runtime = runtime;
  renderConnection();
}

async function openWolfBrowser() {
  if (state.connection.status !== 'connected') {
    log('Connect to wolf serve first.');
    return;
  }
  setButtonState(els.openBrowserButton, 'Opening...', true);
  try {
    await postJson('/api/browser/open', {});
    await refreshRuntimeStatus();
    await refreshQueues();
    log('Wolf browser is ready. Use that window for application pages.');
  } catch (err) {
    log(`Wolf browser could not open: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    setButtonState(els.openBrowserButton, 'Open wolf browser', false);
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
  if (status !== 'connected') {
    state.activeWolfTabId = null;
    state.runtime.browser = {
      status: 'unknown',
      detail: 'Connect to wolf serve first.',
      requiredAction: 'Start wolf serve, then reconnect.',
    };
    stopRunPolling();
  }
  renderConnection();
  log(detail);
}

function renderAll() {
  renderConnection();
  renderView();
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
  renderBatchTailorState();
  renderArtifactButtons();
  renderCurrentPageStatus();
  renderRuntimeOverlay();
}

function renderDaemonActionState() {
  const ready = isRuntimeReady();
  const title = ready ? '' : runtimeBlockReason();
  for (const button of daemonActionButtons()) {
    button.disabled = !ready;
    button.title = title;
  }
}

function daemonActionButtons() {
  return [
    els.importCurrentPageButton,
    els.processInboxButton,
    els.previewResumeButton,
    els.previewCoverLetterButton,
    els.tailorInstantButton,
    els.refreshRunStatusButton,
    els.batchTailorButton,
    els.autofillQuickButton,
    els.regenerateArtifactButton,
  ];
}

function isRuntimeReady() {
  return state.connection.status === 'connected' && state.runtime.browser.status === 'ready';
}

function runtimeBlockReason() {
  if (state.connection.status !== 'connected') return 'Connect to wolf serve first.';
  return state.runtime.browser.requiredAction ?? 'Start the browser from wolf serve, then reconnect.';
}

function renderRuntimeOverlay() {
  const shouldShow = state.connection.status === 'connected' && state.runtime.browser.status !== 'ready';
  els.runtimeOverlay.hidden = !shouldShow;
  els.runtimeOverlayDetail.textContent = state.runtime.browser.requiredAction ??
    'Start the browser from wolf serve, then reconnect.';
  els.runtimeOverlayStatus.textContent = `Current status: ${state.runtime.browser.status}`;
  els.openBrowserButton.disabled = state.connection.status !== 'connected';
}

function renderArtifactButtons() {
  renderArtifactButton(els.previewResumeButton, 'Resume', state.artifacts.resume);
  renderArtifactButton(els.previewCoverLetterButton, 'Cover Letter', state.artifacts.coverLetter);
}

function renderArtifactButton(button, label, artifact) {
  button.classList.toggle('button-success', artifact.status === 'ready');
  if (artifact.status === 'ready') {
    button.textContent = label;
    button.disabled = !isRuntimeReady();
    button.title = isRuntimeReady() ? '' : runtimeBlockReason();
    return;
  }

  button.textContent = `${label} Not Ready`;
  button.disabled = true;
  button.title = `${label} is not ready yet.`;
}

function renderTailorPromptState() {
  if (els.tailorPromptBox.hidden) {
    els.tailorInstantButton.textContent = 'Tailor this job instantly';
    return;
  }
  els.tailorInstantButton.textContent = els.tailorPromptInput.value.trim()
    ? 'Send'
    : 'Tailor this job instantly';
}

function renderFillPromptState() {
  if (els.fillPromptBox.hidden) {
    els.autofillQuickButton.textContent = 'Autofill this page';
    return;
  }
  els.autofillQuickButton.textContent = els.fillPromptInput.value.trim()
    ? 'Send'
    : 'Autofill this page';
}

function renderView() {
  els.currentPanel.hidden = state.view !== 'main';
  els.artifactEditPanel.hidden = state.view !== 'artifact-edit';
  els.configPanel.hidden = state.view !== 'config';
}

function showMainView() {
  state.view = 'main';
  state.activeArtifactKind = null;
  renderView();
}

async function openConfig() {
  state.view = 'config';
  els.configPortInput.value = state.port;
  renderView();
  if (state.connection.status !== 'connected') {
    els.aiProviderDisplay.textContent = 'Connect to wolf serve to load runtime config.';
    return;
  }

  try {
    const body = await getJson('/api/config');
    if (body.status === 'todo') {
      els.aiProviderDisplay.textContent = body.todo ?? 'Config service is not implemented yet.';
      log(body.todo ?? 'Config service is not implemented yet.');
      return;
    }
    els.defaultProfileInput.value = body.defaultProfile ?? els.defaultProfileInput.value;
    els.stagehandSessionsInput.value = String(body.maxStagehandSessions ?? els.stagehandSessionsInput.value);
    els.browserModeInput.value = body.browserMode ?? els.browserModeInput.value;
    els.aiProviderDisplay.textContent = body.aiModel ?? 'No AI model configured.';
  } catch (err) {
    els.aiProviderDisplay.textContent = err instanceof Error ? err.message : String(err);
  }
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

  if (!isRuntimeReady()) {
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
    els.columns[column].list.replaceChildren(...(items.length > 0 ? items.map(renderQueueItem) : [renderEmptyQueueItem(column)]));
  }
  renderBatchTailorState();
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

function renderEmptyQueueItem(column) {
  const li = document.createElement('li');
  li.className = 'empty-state';
  li.textContent = {
    filling: 'No filling pages yet.',
    ready: 'No ready jobs yet.',
    stuck: 'No stuck jobs yet.',
  }[column] ?? 'No items yet.';
  return li;
}

function renderBatchTailorState() {
  const hasJobs = collectKnownJobIds().length > 0;
  if (!hasJobs) {
    els.batchTailorButton.disabled = true;
    els.batchTailorButton.title = 'No eligible jobs yet.';
    return;
  }
  if (isRuntimeReady()) {
    els.batchTailorButton.disabled = false;
    els.batchTailorButton.title = '';
  }
}

async function refreshQueues() {
  if (state.connection.status !== 'connected') {
    state.queues = { filling: [], ready: [], stuck: [] };
    renderQueues();
    return;
  }

  try {
    const body = await getJson('/api/tabs');
    if (body.status === 'todo') {
      state.queues = { filling: [], ready: [], stuck: [] };
      renderQueues();
      log(body.todo ?? 'Wolf browser tab registry is not implemented yet.');
      return;
    }
    state.queues = normalizeQueues(body.queues ?? body.tabs ?? {});
  } catch (err) {
    state.queues = { filling: [], ready: [], stuck: [] };
    log(`Queue refresh failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    renderQueues();
  }
}

function normalizeQueues(rawQueues) {
  return {
    filling: normalizeQueueItems(rawQueues.filling),
    ready: normalizeQueueItems(rawQueues.ready),
    stuck: normalizeQueueItems(rawQueues.stuck),
  };
}

function normalizeQueueItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: item.jobId ?? item.id ?? `item-${index}`,
    jobId: item.jobId ?? item.id ?? null,
    title: item.title ?? 'Untitled job',
    company: item.company ?? item.source ?? 'Unknown company',
    url: item.url ?? null,
    tabId: item.tabId ?? null,
    windowId: item.windowId ?? null,
  }));
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
  if (!currentUrl || !isRuntimeReady()) {
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
  state.currentJobId = item.jobId ?? item.id;
  await refreshArtifactStatus();

  const targetTabId = item.tabId ?? item.id;
  const result = await postJson(`/api/tabs/${encodeURIComponent(targetTabId)}/focus`, {});
  if (result.status === 'todo') {
    log(result.todo ?? 'Wolf browser tab focus is not implemented yet.');
    return;
  }
  state.activeWolfTabId = result.tabId ?? result.id ?? targetTabId;
  log(`Focused ${item.company} - ${item.title}`);
}

async function openPreview(kind) {
  if (!ensureReady()) return;
  const artifact = kind === 'resume' ? state.artifacts.resume : state.artifacts.coverLetter;
  if (artifact.status !== 'ready') {
    log(kind === 'resume' ? 'Resume is not ready yet.' : 'Cover letter is not ready yet.');
    return;
  }
  const jobId = state.currentJobId;
  const artifactPath = kind === 'resume' ? 'resume' : 'cover-letter';
  const url = artifact.url ?? `${daemonBase()}/api/jobs/${encodeURIComponent(jobId)}/artifacts/${artifactPath}`;

  if (hasChromeApi) {
    await chromeApi.tabs.create({ url });
  } else {
    window.open(url, '_blank', 'noopener');
  }
  log(kind === 'resume' ? 'Opened resume preview.' : 'Opened cover letter preview.');
  setArtifactEditMode(kind);
}

function setArtifactEditMode(kind) {
  state.view = 'artifact-edit';
  state.activeArtifactKind = kind;
  const label = kind === 'resume' ? 'Resume' : 'Cover Letter';
  els.artifactEditTitle.textContent = `Edit ${label}`;
  els.regenerateArtifactButton.textContent = `Regenerate ${label}`;
  els.artifactEditPromptInput.value = '';
  renderView();
}

async function refreshArtifactStatus() {
  if (state.connection.status !== 'connected' || !state.currentJobId) {
    state.artifacts = {
      resume: { status: 'not_ready', url: null },
      coverLetter: { status: 'not_ready', url: null },
    };
    renderArtifactButtons();
    return;
  }

  try {
    const res = await fetchWithTimeout(
      `${daemonBase()}/api/jobs/${encodeURIComponent(state.currentJobId)}/artifacts`,
      { method: 'GET' },
    );
    const body = await res.json().catch(() => ({}));
    state.artifacts = {
      resume: body.resume ?? { status: 'not_ready', url: null },
      coverLetter: body.coverLetter ?? { status: 'not_ready', url: null },
    };
    if (!res.ok && body.status === 'todo') {
      log(body.todo ?? 'Artifact readiness is not implemented yet.');
    }
  } catch (err) {
    state.artifacts = {
      resume: { status: 'not_ready', url: null },
      coverLetter: { status: 'not_ready', url: null },
    };
    log(`Artifact readiness check failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    renderArtifactButtons();
  }
}

async function importCurrentPage() {
  if (!ensureReady()) return;
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

async function processInboxWithAi() {
  if (!ensureReady()) return;
  const confirmed = window.confirm(
    'Process raw inbox items into jobs? Future AI extraction may use paid batch API calls.',
  );
  if (!confirmed) {
    log('Inbox processing cancelled.');
    return;
  }

  setButtonState(els.processInboxButton, 'Queueing...', true);
  try {
    const result = await postJson('/api/inbox/process', { limit: 20, shardSize: 20 });
    if (result.status === 'empty') {
      setButtonState(els.processInboxButton, 'Nothing to Process', false);
      log('No raw inbox items to process.');
      return;
    }
    if (result.status === 'completed') {
      setButtonState(els.processInboxButton, 'Processed', false);
      log(`Inbox processed: ${result.itemCount ?? 0} item(s), ${result.jobIds?.length ?? 0} job(s) created.`);
      await refreshQueues();
      return;
    }
    setButtonState(els.processInboxButton, 'Queued', false);
    log(`Inbox processing queued: ${result.itemCount ?? 0} item(s), ${result.shardCount ?? 0} shard(s).`);
  } catch (err) {
    setButtonState(els.processInboxButton, 'Queue Failed', false);
    setConnection('disconnected', err instanceof Error ? err.message : String(err));
  } finally {
    resetButtonLabelLater(els.processInboxButton, 'Process Inbox');
  }
}

async function batchTailor() {
  if (!ensureReady()) return;
  const jobIds = collectKnownJobIds();
  if (jobIds.length === 0) {
    log('No eligible jobs for batch tailor yet.');
    return;
  }
  const confirmed = window.confirm(
    `Batch tailor ${jobIds.length} job(s)? This may use paid batch API calls and will run in the background.`,
  );
  if (!confirmed) {
    log('Batch tailor cancelled.');
    return;
  }

  setButtonState(els.batchTailorButton, 'Queueing...', true);
  try {
    const result = await postJson('/api/tailor/batch', { jobIds });
    if (result.status === 'todo') {
      setButtonState(els.batchTailorButton, 'Batch TODO', false);
      log(result.todo ?? 'Batch tailor is not implemented yet.');
      return;
    }
    setButtonState(els.batchTailorButton, 'Batch Queued', false);
    log(`Batch tailor started: ${result.runId ?? 'run pending'}`);
    if (result.runId) startRunPolling(result.runId);
  } catch (err) {
    setButtonState(els.batchTailorButton, 'Batch Failed', false);
    log(`Batch tailor failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    resetButtonLabelLater(els.batchTailorButton, 'Batch Tailor');
  }
}

async function tailorThisJobInstantly() {
  if (!ensureReady()) return;

  if (els.tailorPromptBox.hidden) {
    els.tailorPromptBox.hidden = false;
    els.tailorPromptInput.focus();
    renderTailorPromptState();
    return;
  }

  const userPrompt = els.tailorPromptInput.value.trim();
  setButtonState(els.tailorInstantButton, 'Sending...', true);
  try {
    const result = await postJson('/api/tailor/quick', {
      jobId: state.currentJobId,
      userPrompt,
      artifactTargets: ['resume', 'cover_letter'],
    });
    els.tailorPromptBox.hidden = true;
    els.tailorPromptInput.value = '';
    setButtonState(els.tailorInstantButton, 'Tailoring...', true);
    log(`Instant tailor started: ${result.runId ?? 'run pending'}`);
    if (result.runId) startRunPolling(result.runId);
  } catch (err) {
    els.tailorPromptBox.hidden = true;
    const message = err instanceof Error ? err.message : String(err);
    setButtonState(els.tailorInstantButton, 'Tailor TODO', false);
    log(`Instant tailor unavailable: ${message}`);
  } finally {
    resetButtonLabelLater(els.tailorInstantButton, 'Tailor this job instantly');
  }
}

async function autofillThisPage() {
  if (!ensureReady()) return;

  if (els.fillPromptBox.hidden) {
    els.fillPromptBox.hidden = false;
    els.fillPromptInput.focus();
    renderFillPromptState();
    log('wolf will fill this page only. It will not submit the application.');
    return;
  }

  const userPrompt = els.fillPromptInput.value.trim();
  setButtonState(els.autofillQuickButton, 'Sending...', true);
  try {
    const result = await postJson('/api/fill/quick', {
      jobId: state.currentJobId,
      tabId: state.activeWolfTabId ?? null,
      userPrompt,
    });
    els.fillPromptBox.hidden = true;
    els.fillPromptInput.value = '';
    setButtonState(els.autofillQuickButton, 'Filling...', true);
    log(`Autofill started with no auto-submit: ${result.runId ?? 'run pending'}`);
    if (result.runId) startRunPolling(result.runId);
  } catch (err) {
    els.fillPromptBox.hidden = true;
    const message = err instanceof Error ? err.message : String(err);
    setButtonState(els.autofillQuickButton, 'Autofill TODO', false);
    log(`Autofill unavailable: ${message}`);
  } finally {
    resetButtonLabelLater(els.autofillQuickButton, 'Autofill this page');
  }
}

async function regenerateArtifact() {
  if (!ensureReady()) return;
  const kind = state.activeArtifactKind;
  if (kind !== 'resume' && kind !== 'cover-letter') {
    log('Open a resume or cover letter before regenerating.');
    return;
  }
  const userPrompt = els.artifactEditPromptInput.value.trim();
  if (!userPrompt) {
    log('Add edit instructions before regenerating.');
    return;
  }

  const label = kind === 'resume' ? 'Resume' : 'Cover Letter';
  setButtonState(els.regenerateArtifactButton, 'Sending...', true);
  try {
    const result = await postJson('/api/artifacts/regenerate', {
      jobId: state.currentJobId,
      artifactType: kind === 'resume' ? 'resume' : 'cover_letter',
      existingArtifactText: '',
      userPrompt,
    });
    setButtonState(els.regenerateArtifactButton, 'Regenerating...', true);
    log(`${label} regeneration started: ${result.runId ?? 'run pending'}`);
    if (result.runId) startRunPolling(result.runId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setButtonState(els.regenerateArtifactButton, 'Regenerate TODO', false);
    log(`${label} regeneration unavailable: ${message}`);
  } finally {
    resetButtonLabelLater(els.regenerateArtifactButton, `Regenerate ${label}`);
  }
}

async function refreshActiveRunOrArtifacts() {
  if (state.activeRunId) {
    await pollRunStatus(state.activeRunId);
    return;
  }
  await refreshArtifactStatus();
}

function startRunPolling(runId) {
  state.activeRunId = runId;
  if (state.runPollTimer) clearInterval(state.runPollTimer);
  state.runPollTimer = setInterval(() => {
    pollRunStatus(runId).catch((err) => {
      log(`Run status check failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, RUN_POLL_MS);
}

async function pollRunStatus(runId) {
  const res = await fetchWithTimeout(`${daemonBase()}/api/runs/${encodeURIComponent(runId)}`, {
    method: 'GET',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && body.status === 'todo') {
    log(body.todo ?? 'Run polling is not implemented yet.');
    stopRunPolling();
    return;
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  log(`Run ${runId}: ${body.status ?? 'unknown'}`);
  if (body.artifacts) {
    state.artifacts = {
      resume: body.artifacts.resume ?? state.artifacts.resume,
      coverLetter: body.artifacts.coverLetter ?? state.artifacts.coverLetter,
    };
    renderArtifactButtons();
  }
  if (['ready', 'failed'].includes(body.status)) {
    stopRunPolling();
    await refreshArtifactStatus();
  }
}

function stopRunPolling() {
  if (state.runPollTimer) clearInterval(state.runPollTimer);
  state.runPollTimer = null;
  state.activeRunId = null;
}

async function saveConfig() {
  const port = els.configPortInput.value.trim();
  if (!/^[0-9]{4,5}$/.test(port)) {
    log('Config port must be 4-5 digits.');
    return;
  }

  await storePort(port);
  els.portInput.value = port;
  setButtonState(els.saveConfigButton, 'Saving...', true);
  try {
    const result = await postJson('/api/config', {
      port,
      defaultProfile: els.defaultProfileInput.value.trim() || 'default',
    });
    if (result.status === 'todo') {
      log(result.todo ?? 'Config write is not implemented yet.');
    } else {
      log('Config saved: port and default profile.');
    }
  } catch (err) {
    log(`Config save unavailable: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    setButtonState(els.saveConfigButton, 'Save Config', false);
  }
}

function collectKnownJobIds() {
  return Object.values(state.queues)
    .flat()
    .map((item) => item.id)
    .filter(Boolean);
}

function ensureReady() {
  if (isRuntimeReady()) return true;
  log(runtimeBlockReason());
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
    renderDaemonActionState();
    renderArtifactButtons();
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
  const parsed = await res.json().catch(() => null);
  if (!res.ok) {
    if (parsed?.status === 'todo') return parsed;
    throw new Error(parsed?.error ?? parsed?.todo ?? `HTTP ${res.status}`);
  }
  return parsed ?? {};
}

async function getJson(path) {
  const res = await fetchWithTimeout(`${daemonBase()}${path}`, {
    method: 'GET',
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok) {
    if (parsed?.status === 'todo') return parsed;
    throw new Error(parsed?.error ?? parsed?.todo ?? `HTTP ${res.status}`);
  }
  return parsed ?? {};
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
