/** Chrome's extension API object when the side panel runs inside Chrome. */
const chromeApi = globalThis.chrome;

/** Whether this file is running as a real extension instead of local demo HTML. */
const hasChromeApi = Boolean(chromeApi?.runtime?.id);

/** Default local wolf serve port; kept in sync with the serve command default. */
const DEFAULT_DAEMON_PORT = '47823';

/** Interval for lightweight daemon/runtime health checks. */
const HEARTBEAT_MS = 5_000;

/** Interval for local run-status checks after an AI run has been queued. */
const RUN_POLL_MS = 5_000;

/** Stable label used when the import button returns to its normal state. */
const IMPORT_PAGE_LABEL = 'Import Page';

/** Tooltip prefix for controls that are intentionally visible but unfinished. */
const INCOMPLETE_TOOLTIP = 'Not implemented yet';

/** Message shown on the disabled application-kanban MVP placeholder. */
const QUEUE_COMING_SOON_MESSAGE = 'Application queue is not implemented yet. Coming soon.';

/** Explains why form filling is present in the UI but blocked for this milestone. */
const AUTOFILL_BLOCKED_REASON =
  'Stagehand observe, cache, and replay form filling is not implemented yet.';

/** Explains why outreach generation is present in the UI but blocked for this milestone. */
const OUTREACH_BLOCKED_REASON = 'Outreach draft generation is not implemented yet.';

/** Explains why deleting processed jobs from the companion is not enabled yet. */
const PROCESS_DELETE_BLOCKED_REASON = 'Clearing processed jobs from the companion UI is not implemented yet.';

/** Explains why deleting generated tailor artifacts from the companion is not enabled yet. */
const TAILOR_DELETE_BLOCKED_REASON = 'Clearing tailored artifacts from the companion UI is not implemented yet.';

/** Job-board aggregator pages where importing the company apply page is usually better. */
const AGGREGATOR_PLATFORMS = [
  {
    name: 'LinkedIn',
    matches: (url) => hostnameEndsWith(url.hostname, 'linkedin.com') && url.pathname.includes('/jobs/'),
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

/** Mutable UI state for the side panel; render functions read only from here. */
const state = {
  /** Current wolf serve port as typed or loaded from extension storage. */
  port: DEFAULT_DAEMON_PORT,
  /** Daemon connectivity state shown in the top-right badge and connection panel. */
  connection: { status: 'idle', detail: 'Waiting for local wolf serve.' },
  /** Runtime/browser readiness reported by wolf serve. */
  runtime: {
    browser: {
      status: 'unknown',
      detail: 'Connect to wolf serve first.',
      requiredAction: 'Start wolf serve, then reconnect.',
    },
  },
  /** Active browser tab reported by Chrome, or the local demo page fallback. */
  currentTab: null,
  /** Browser tab id owned by wolf; used to ensure automation stays in the wolf instance. */
  activeWolfTabId: null,
  /** Current tab import status: normal, duplicate, or aggregator warning. */
  currentPageStatus: { kind: 'normal', detail: null },
  /** Ready job id that matches the current page URL, if any. */
  currentJobId: null,
  /** Cheap local inbox status used to gate Process controls. */
  inbox: { hasRaw: false, rawCount: 0 },
  /** Tailor queue summary used to gate Batch Tailor. */
  tailor: { untailoredJobCount: 0 },
  /** Active panel view: main console, artifact editor, or config. */
  view: 'main',
  /** Artifact kind currently being edited in the regenerate panel. */
  activeArtifactKind: null,
  /** Current background AI run id being watched by the Check run chip. */
  activeRunId: null,
  /** UI metadata for restoring button labels when the active run completes. */
  activeRunUi: null,
  /** Timer id for the 5s local run-status polling loop. */
  runPollTimer: null,
  /** Current resume and cover-letter readiness for the active job. */
  artifacts: {
    resume: { status: 'not_ready', url: null },
    coverLetter: { status: 'not_ready', url: null },
  },
  /** Future kanban cursors; retained so Next buttons have an obvious state home. */
  cursors: { filling: 0, ready: 0, stuck: 0 },
  /** Application queue placeholder data; currently only ready jobs are backed by SQLite. */
  queues: {
    filling: [],
    ready: [],
    stuck: [],
  },
};

/** Cached DOM element references. Keeping these centralized prevents selector drift. */
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
  configDefaultInput: document.querySelector('#configDefaultInput'),
  configHuntMinScoreInput: document.querySelector('#configHuntMinScoreInput'),
  configHuntMaxResultsInput: document.querySelector('#configHuntMaxResultsInput'),
  configTailorModelInput: document.querySelector('#configTailorModelInput'),
  configCoverLetterToneInput: document.querySelector('#configCoverLetterToneInput'),
  configScoreModelInput: document.querySelector('#configScoreModelInput'),
  configReachModelInput: document.querySelector('#configReachModelInput'),
  configEmailToneInput: document.querySelector('#configEmailToneInput'),
  configMaxEmailsPerDayInput: document.querySelector('#configMaxEmailsPerDayInput'),
  configFillModelInput: document.querySelector('#configFillModelInput'),
  saveConfigButton: document.querySelector('#saveConfigButton'),
  resetConfigButton: document.querySelector('#resetConfigButton'),
  portInput: document.querySelector('#portInput'),
  reconnectButton: document.querySelector('#reconnectButton'),
  connectionBadge: document.querySelector('#connectionBadge'),
  connectionDetail: document.querySelector('#connectionDetail'),
  runtimeOverlay: document.querySelector('#runtimeOverlay'),
  runtimeOverlayDetail: document.querySelector('#runtimeOverlayDetail'),
  runtimeOverlayStatus: document.querySelector('#runtimeOverlayStatus'),
  openBrowserButton: document.querySelector('#openBrowserButton'),
  openBrowserInlineButton: document.querySelector('#openBrowserInlineButton'),
  currentTabLabel: document.querySelector('#currentTabLabel'),
  duplicateNotice: document.querySelector('#duplicateNotice'),
  importCurrentPageButton: document.querySelector('#importCurrentPageButton'),
  deleteImportButton: document.querySelector('#deleteImportButton'),
  processCurrentPageButton: document.querySelector('#processCurrentPageButton'),
  processInboxButton: document.querySelector('#processInboxButton'),
  deleteProcessButton: document.querySelector('#deleteProcessButton'),
  previewResumeButton: document.querySelector('#previewResumeButton'),
  previewCoverLetterButton: document.querySelector('#previewCoverLetterButton'),
  tailorInstantButton: document.querySelector('#tailorInstantButton'),
  deleteTailorButton: document.querySelector('#deleteTailorButton'),
  workflowProgressNumber: document.querySelector('#workflowProgressNumber'),
  workflowStageKicker: document.querySelector('#workflowStageKicker'),
  workflowStageTitle: document.querySelector('#workflowStageTitle'),
  refreshRunStatusButton: document.querySelector('#refreshRunStatusButton'),
  batchTailorButton: document.querySelector('#batchTailorButton'),
  autofillQuickButton: document.querySelector('#autofillQuickButton'),
  outreachDraftButton: document.querySelector('#outreachDraftButton'),
  actionHint: document.querySelector('#actionHint'),
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

/** Monotonic request id so stale duplicate-check responses cannot overwrite newer tabs. */
let pageStatusRequestSeq = 0;

await loadStoredPort();
wireEvents();
renderAll();
startHeartbeat();
await refreshCurrentTab();

/** Builds the local daemon base URL from the currently selected port. */
function daemonBase() {
  return `http://127.0.0.1:${state.port}`;
}

/** Loads the remembered wolf serve port from Chrome storage or localStorage. */
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

/** Normalizes an optional stored port value to a usable daemon port string. */
function normalizeStoredPort(port) {
  if (!port) return DEFAULT_DAEMON_PORT;
  return port;
}

/** Persists the selected daemon port for the next side-panel session. */
async function storePort(port) {
  state.port = port;
  if (hasChromeApi) {
    await chromeApi.storage.local.set({ wolfServePort: port });
  } else {
    localStorage.setItem('wolfServePort', port);
  }
}

/** Attaches all DOM and Chrome event listeners for the side panel. */
function wireEvents() {
  els.configButton.addEventListener('click', openConfig);
  els.openBrowserButton.addEventListener('click', openWolfBrowser);
  els.openBrowserInlineButton.addEventListener('click', openWolfBrowser);
  els.closeConfigButton.addEventListener('click', showMainView);
  els.saveConfigButton.addEventListener('click', saveConfig);
  els.resetConfigButton.addEventListener('click', resetConfig);
  els.backToCurrentButton.addEventListener('click', showMainView);
  els.regenerateArtifactButton.addEventListener('click', regenerateArtifact);
  els.reconnectButton.addEventListener('click', reconnect);
  els.importCurrentPageButton.addEventListener('click', importCurrentPage);
  els.deleteImportButton.addEventListener('click', deleteCurrentImport);
  els.processCurrentPageButton.addEventListener('click', processCurrentPageWithAi);
  els.processInboxButton.addEventListener('click', processInboxWithAi);
  els.deleteProcessButton.addEventListener('click', clearProcessedJob);
  els.previewResumeButton.addEventListener('click', () => openPreview('resume'));
  els.previewCoverLetterButton.addEventListener('click', () => openPreview('cover-letter'));
  els.tailorInstantButton.addEventListener('click', tailorThisJobInstantly);
  els.deleteTailorButton.addEventListener('click', clearTailorArtifacts);
  els.refreshRunStatusButton.addEventListener('click', refreshActiveRunOrArtifacts);
  els.batchTailorButton.addEventListener('click', batchTailor);
  els.autofillQuickButton.addEventListener('click', autofillThisPage);
  els.outreachDraftButton.addEventListener('click', generateOutreachDraft);
  els.tailorPromptInput.addEventListener('input', renderTailorPromptState);
  els.fillPromptInput.addEventListener('input', renderFillPromptState);

  document.querySelectorAll('[data-next-column]').forEach((button) => {
    button.disabled = true;
    button.title = QUEUE_COMING_SOON_MESSAGE;
  });

  if (hasChromeApi) {
    chromeApi.tabs.onActivated.addListener(refreshCurrentTab);
    chromeApi.tabs.onUpdated.addListener((_tabId, changeInfo) => {
      if (changeInfo.status === 'complete') refreshCurrentTab();
    });
  }
}

/** Validates the port, pings wolf serve, then refreshes all local UI state. */
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
    await refreshQueues();
    await refreshInboxStatus();
    await refreshCurrentPageStatus();
    await refreshArtifactStatus();
  } catch (err) {
    setConnection('disconnected', err instanceof Error ? err.message : String(err));
  }
}

/** Pings the daemon and verifies the nonce so stale/local impostor responses are rejected. */
async function pingDaemon(nonce = Math.random().toString(36).slice(2)) {
  const res = await fetchWithTimeout(`${daemonBase()}/api/ping?nonce=${encodeURIComponent(nonce)}`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.nonce !== nonce) throw new Error('nonce mismatch');
  return body;
}

/** Starts lightweight connection monitoring while the side panel is open. */
function startHeartbeat() {
  setInterval(() => {
    if (state.connection.status !== 'connected') return;
    pingDaemon()
      .then(async () => {
        await refreshRuntimeStatus();
        await refreshInboxStatus();
        await refreshQueues();
      })
      .catch(() => {
        setConnection('disconnected', 'Lost connection to wolf serve.');
      });
  }, HEARTBEAT_MS);
}

/** Reads browser/runtime readiness from wolf serve. */
async function refreshRuntimeStatus() {
  const res = await fetchWithTimeout(`${daemonBase()}/api/runtime/status`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const runtime = await res.json();
  state.runtime = runtime;
  renderConnection();
}

/** Opens or focuses the dedicated wolf-controlled browser instance. */
async function openWolfBrowser() {
  if (state.connection.status !== 'connected') {
    log('Connect to wolf serve first.');
    return;
  }
  setButtonState(els.openBrowserButton, 'Opening...', true);
  setButtonState(els.openBrowserInlineButton, 'Opening...', true);
  try {
    await postJson('/api/browser/open', {});
    await refreshRuntimeStatus();
    await refreshQueues();
    log('Wolf browser is ready. Use that window for application pages.');
  } catch (err) {
    log(`Wolf browser could not open: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    setButtonState(els.openBrowserButton, 'Open wolf browser', false);
    setButtonState(els.openBrowserInlineButton, 'Open wolf browser', false);
    renderActionAvailability();
  }
}

/** Fetch wrapper with a short timeout so the side panel never feels frozen. */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_500);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Updates connection state and clears runtime-dependent data when disconnected. */
function setConnection(status, detail) {
  state.connection = { status, detail };
  if (status !== 'connected') {
    state.activeWolfTabId = null;
    state.runtime.browser = {
      status: 'unknown',
      detail: 'Connect to wolf serve first.',
      requiredAction: 'Start wolf serve, then reconnect.',
    };
    state.inbox = { hasRaw: false, rawCount: 0 };
    state.currentJobId = null;
    stopRunPolling();
  }
  renderConnection();
  log(detail);
}

/** Renders every top-level section after initial load or broad state changes. */
function renderAll() {
  renderConnection();
  renderView();
  renderCurrentTab();
  renderQueues();
  renderIncompleteBadges();
}

/** Renders connection badge, runtime overlay, and controls that depend on daemon state. */
function renderConnection() {
  els.connectionBadge.className = `status-badge status-badge--${state.connection.status}`;
  els.connectionBadge.textContent = {
    connected: 'Online',
    disconnected: 'Offline',
    idle: 'Idle',
  }[state.connection.status];
  els.connectionDetail.textContent = state.connection.detail;
  renderDaemonActionState();
  renderArtifactButtons();
  renderCurrentPageStatus();
  renderRuntimeOverlay();
  renderActionAvailability();
  renderIncompleteBadges();
}

/** Applies runtime-readiness gating to daemon-backed action buttons. */
function renderDaemonActionState() {
  const ready = isRuntimeReady();
  const title = ready ? '' : runtimeBlockReason();
  for (const button of daemonActionButtons()) {
    const incomplete = incompleteReason(button);
    button.disabled = !ready || Boolean(incomplete);
    button.title = incomplete ? `${INCOMPLETE_TOOLTIP}: ${incomplete}` : title;
  }
}

/** Returns all buttons whose primary action requires wolf serve and the wolf browser. */
function daemonActionButtons() {
  return [
    els.importCurrentPageButton,
    els.deleteImportButton,
    els.processCurrentPageButton,
    els.processInboxButton,
    els.tailorInstantButton,
    els.refreshRunStatusButton,
    els.batchTailorButton,
    els.autofillQuickButton,
    els.outreachDraftButton,
    els.regenerateArtifactButton,
  ];
}

/** True only when wolf serve is connected and its browser instance is ready. */
function isRuntimeReady() {
  return state.connection.status === 'connected' && state.runtime.browser.status === 'ready';
}

/** Human-readable reason for blocking runtime-dependent actions. */
function runtimeBlockReason() {
  if (state.connection.status !== 'connected') return 'Connect to wolf serve first.';
  return state.runtime.browser.requiredAction ?? 'Start the browser from wolf serve, then reconnect.';
}

/** Shows the large blocking overlay when wolf serve is up but the browser is not ready. */
function renderRuntimeOverlay() {
  const shouldShow = state.connection.status === 'connected' && state.runtime.browser.status !== 'ready';
  els.runtimeOverlay.hidden = !shouldShow;
  els.runtimeOverlayDetail.textContent = state.runtime.browser.requiredAction ??
    'Start the browser from wolf serve, then reconnect.';
  els.runtimeOverlayStatus.textContent = `Current status: ${state.runtime.browser.status}`;
  els.openBrowserButton.disabled = state.connection.status !== 'connected';
}

/** Recomputes action-button availability from the latest runtime, inbox, and job state. */
function renderActionAvailability() {
  syncCurrentJobFromQueues();
  renderBrowserOpenButton();
  renderImportDeleteState();
  renderDeleteStubState();
  renderProcessCurrentPageState();
  renderProcessInboxState();
  renderTailorInstantState();
  renderRefreshStatusState();
  renderBatchTailorState();
  renderActionHint();
}

/** Keeps unfinished destructive cleanup controls visibly unavailable without warning badges. */
function renderDeleteStubState() {
  els.deleteProcessButton.disabled = true;
  els.deleteProcessButton.title = PROCESS_DELETE_BLOCKED_REASON;
  els.deleteTailorButton.disabled = true;
  els.deleteTailorButton.title = TAILOR_DELETE_BLOCKED_REASON;
}

/** Updates the inline browser button to say Open or Show depending on browser state. */
function renderBrowserOpenButton() {
  const connected = state.connection.status === 'connected';
  setButtonLabel(
    els.openBrowserInlineButton,
    state.runtime.browser.status === 'ready' ? 'Show wolf browser' : 'Open wolf browser',
  );
  els.openBrowserInlineButton.disabled = !connected;
  els.openBrowserInlineButton.title = connected ? '' : 'Connect to wolf serve first.';
}

/** Shows the import-delete square only when the current page maps to an inbox item. */
function renderImportDeleteState() {
  const detail = state.currentPageStatus.detail;
  const canDelete = isRuntimeReady() &&
    state.currentPageStatus.kind === 'duplicate' &&
    typeof detail?.inboxId === 'string';
  els.deleteImportButton.hidden = !canDelete;
  els.deleteImportButton.disabled = !canDelete;
  els.deleteImportButton.title = canDelete ? 'Delete this import from wolf inbox.' : 'No import to delete.';
}

/** Gates single-page processing to raw imports only. */
function renderProcessCurrentPageState() {
  setButtonLabel(els.processCurrentPageButton, 'Process this page');
  if (!isRuntimeReady()) {
    els.processCurrentPageButton.disabled = true;
    els.processCurrentPageButton.title = runtimeBlockReason();
    return;
  }
  const detail = state.currentPageStatus.detail;
  if (
    state.currentPageStatus.kind !== 'duplicate' ||
    typeof detail?.inboxId !== 'string' ||
    detail.status !== 'raw'
  ) {
    els.processCurrentPageButton.disabled = true;
    els.processCurrentPageButton.title = 'Import this page first, or use Batch Process for all raw inbox items.';
    return;
  }
  els.processCurrentPageButton.disabled = false;
  els.processCurrentPageButton.title = 'Process only this imported page into a Ready job.';
}

/** Renders batch inbox processing count and disabled reason. */
function renderProcessInboxState() {
  setButtonLabel(els.processInboxButton, `Batch Process (${state.inbox.rawCount})`);
  if (!isRuntimeReady()) {
    els.processInboxButton.disabled = true;
    els.processInboxButton.title = runtimeBlockReason();
    return;
  }
  if (!state.inbox.hasRaw) {
    els.processInboxButton.disabled = true;
    els.processInboxButton.title = 'Import at least one page before batch processing the inbox.';
    return;
  }
  els.processInboxButton.disabled = false;
  els.processInboxButton.title = `Process ${state.inbox.rawCount} imported raw page(s) into Ready jobs.`;
}

/** Enables instant tailoring only when the current URL maps to a Ready job. */
function renderTailorInstantState() {
  if (!isRuntimeReady()) {
    els.tailorInstantButton.disabled = true;
    els.tailorInstantButton.title = runtimeBlockReason();
    return;
  }
  if (!state.currentJobId) {
    els.tailorInstantButton.disabled = true;
    els.tailorInstantButton.title = 'This page is not a Ready job yet. Import it, then Process Inbox.';
    return;
  }
  els.tailorInstantButton.disabled = false;
  els.tailorInstantButton.title = 'Tailor resume and cover letter for this Ready job.';
}

/** Renders the Check run chip for active background AI work. */
function renderRefreshStatusState() {
  setButtonLabel(els.refreshRunStatusButton, state.activeRunId ? 'Check run' : 'No run');
  if (!isRuntimeReady()) {
    els.refreshRunStatusButton.disabled = true;
    els.refreshRunStatusButton.title = runtimeBlockReason();
    return;
  }
  if (!state.activeRunId) {
    els.refreshRunStatusButton.disabled = true;
    els.refreshRunStatusButton.title = 'No active AI run to check yet.';
    return;
  }
  els.refreshRunStatusButton.disabled = false;
  els.refreshRunStatusButton.title = 'Check the latest local status for the active AI run.';
}

/** Copies the computed workflow status into the progress card. */
function renderActionHint() {
  const workflow = workflowStatus();
  els.workflowProgressNumber.textContent = workflow.progress;
  els.workflowStageKicker.textContent = workflow.kicker;
  els.workflowStageTitle.textContent = workflow.title;
  els.actionHint.textContent = workflow.hint;
}

/** Computes the current 3-step MVP workflow status shown above Current Page. */
function workflowStatus() {
  if (!isRuntimeReady()) {
    return {
      progress: '0/3',
      kicker: 'Setup',
      title: 'Connect wolf',
      hint: runtimeBlockReason(),
    };
  }
  if (state.activeRunId) {
    return {
      progress: state.activeRunUi?.stepProgress ?? '2/3',
      kicker: state.activeRunUi?.stepKicker ?? 'AI run active',
      title: 'Processing',
      hint: 'wolf checks provider status every 60 seconds. Use Check run for the latest local run state.',
    };
  }
  if (state.inbox.hasRaw) {
    return {
      progress: '1/3',
      kicker: 'Step 1 of 3',
      title: 'Import done',
      hint: `${state.inbox.rawCount} imported page(s) are waiting. Process Inbox turns them into Ready jobs.`,
    };
  }
  if (state.tailor.untailoredJobCount > 0) {
    return {
      progress: '2/3',
      kicker: 'Step 2 of 3',
      title: 'Process done',
      hint: `${state.tailor.untailoredJobCount} job(s) are ready for tailoring. Use instant tailor for this page or Batch Tailor for the queue.`,
    };
  }
  return {
    progress: '3/3',
    kicker: 'Ready',
    title: 'All caught up',
    hint: 'MVP steps: 1 Import, 2 Process, 3 Tailor. TODO: Fill and Reach are planned after this flow.',
  };
}

/** Renders both resume and cover-letter artifact buttons. */
function renderArtifactButtons() {
  renderArtifactButton(els.previewResumeButton, 'Resume', state.artifacts.resume);
  renderArtifactButton(els.previewCoverLetterButton, 'Cover Letter', state.artifacts.coverLetter);
}

/** Renders one artifact button as ready or not ready. */
function renderArtifactButton(button, label, artifact) {
  button.classList.toggle('button-success', artifact.status === 'ready');
  if (artifact.status === 'ready') {
    setButtonLabel(button, label);
    button.disabled = !isRuntimeReady();
    button.title = isRuntimeReady() ? '' : runtimeBlockReason();
    return;
  }

  setButtonLabel(button, `${label} Not Ready`);
  button.disabled = true;
  button.title = `${label} is not ready yet.`;
}

/** Switches the instant tailor button between first-click and send states. */
function renderTailorPromptState() {
  if (els.tailorPromptBox.hidden) {
    setButtonLabel(els.tailorInstantButton, 'Tailor this job instantly');
    return;
  }
  setButtonLabel(els.tailorInstantButton, els.tailorPromptInput.value.trim()
    ? 'Send'
    : 'Tailor this job instantly');
}

/** Switches the autofill button between first-click and send states. */
function renderFillPromptState() {
  if (els.fillPromptBox.hidden) {
    setButtonLabel(els.autofillQuickButton, 'Autofill this page');
    return;
  }
  setButtonLabel(els.autofillQuickButton, els.fillPromptInput.value.trim()
    ? 'Send'
    : 'Autofill this page');
}

/** Shows exactly one main subview: current page, artifact editor, or config. */
function renderView() {
  els.currentPanel.hidden = state.view !== 'main';
  els.artifactEditPanel.hidden = state.view !== 'artifact-edit';
  els.configPanel.hidden = state.view !== 'config';
}

/** Returns from secondary panels to the main current-page console. */
function showMainView() {
  state.view = 'main';
  state.activeArtifactKind = null;
  renderView();
}

/** Opens the config panel and hydrates it from wolf.toml when available. */
async function openConfig() {
  state.view = 'config';
  renderView();
  if (state.connection.status !== 'connected') {
    log('Connect to wolf serve to load wolf.toml config.');
    return;
  }

  try {
    const body = await getJson('/api/config');
    if (body.status === 'todo') {
      log(body.todo ?? 'Config service is not implemented yet.');
      return;
    }
    renderConfigForm(body);
  } catch (err) {
    log(`Config load unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Renders the active Chrome tab title and URL in the Current Page card. */
function renderCurrentTab() {
  if (!state.currentTab) {
    els.currentTabLabel.textContent = hasChromeApi ? 'Reading...' : 'Demo mode';
    setCurrentPageStatus({ kind: 'normal', detail: null });
    return;
  }
  const title = state.currentTab.title || 'Current tab';
  const url = state.currentTab.url ? ` - ${state.currentTab.url}` : '';
  els.currentTabLabel.textContent = `${title}${url}`;
  syncCurrentJobFromQueues();
  renderActionAvailability();
}

/** Renders duplicate/import warnings and the import button visual state. */
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

/** Renders the placeholder kanban while the real application queue is unfinished. */
function renderQueues() {
  for (const column of Object.keys(state.queues)) {
    els.columns[column].count.textContent = '—';
    els.columns[column].list.replaceChildren(renderEmptyQueueItem(column));
  }
  renderActionAvailability();
}

/** Builds one future queue item row. Currently retained for the queued-tab milestone. */
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

/** Builds the disabled empty-state row for a placeholder queue column. */
function renderEmptyQueueItem(column) {
  const li = document.createElement('li');
  li.className = 'empty-state';
  li.textContent = column ? 'Queue not implemented yet.' : QUEUE_COMING_SOON_MESSAGE;
  return li;
}

/** Renders batch tailor count and disabled reason. */
function renderBatchTailorState() {
  setButtonLabel(els.batchTailorButton, `Batch Tailor (${state.tailor.untailoredJobCount})`);
  if (!isRuntimeReady()) {
    els.batchTailorButton.disabled = true;
    els.batchTailorButton.title = runtimeBlockReason();
    return;
  }
  if (state.tailor.untailoredJobCount === 0) {
    els.batchTailorButton.disabled = true;
    els.batchTailorButton.title = 'No untailored jobs yet. Process Inbox first, or all jobs are already tailored.';
    return;
  }
  els.batchTailorButton.disabled = false;
  els.batchTailorButton.title = `Batch tailor ${state.tailor.untailoredJobCount} untailored job(s).`;
}

/** Refreshes Ready-job and untailored counts from wolf serve. */
async function refreshQueues() {
  if (!isRuntimeReady()) {
    state.queues = { filling: [], ready: [], stuck: [] };
    state.tailor = { untailoredJobCount: 0 };
    state.currentJobId = null;
    renderQueues();
    return;
  }
  try {
    const result = await getJson('/api/tabs');
    state.queues = normalizeQueues(result.queues ?? {});
    state.tailor = {
      untailoredJobCount: Number(result.counts?.untailoredJobs ?? state.queues.ready.length),
    };
  } catch (err) {
    state.queues = { filling: [], ready: [], stuck: [] };
    state.tailor = { untailoredJobCount: 0 };
    log(`Could not refresh Ready jobs: ${err instanceof Error ? err.message : String(err)}`);
  }
  syncCurrentJobFromQueues();
  renderQueues();
}

/** Refreshes the number of raw imported pages waiting for processing. */
async function refreshInboxStatus() {
  if (state.connection.status !== 'connected') {
    state.inbox = { hasRaw: false, rawCount: 0 };
    renderActionAvailability();
    return;
  }
  try {
    const result = await getJson('/api/inbox/status');
    const rawCount = Number(result.rawCount ?? 0);
    state.inbox = { hasRaw: Boolean(result.hasRaw), rawCount };
  } catch (err) {
    state.inbox = { hasRaw: false, rawCount: 0 };
    log(`Could not refresh inbox status: ${err instanceof Error ? err.message : String(err)}`);
  }
  renderActionAvailability();
}

/** Normalizes daemon queue payloads into the UI's queue shape. */
function normalizeQueues(rawQueues) {
  return {
    filling: normalizeQueueItems(rawQueues.filling),
    ready: normalizeQueueItems(rawQueues.ready),
    stuck: normalizeQueueItems(rawQueues.stuck),
  };
}

/** Normalizes one queue array and fills missing display fields safely. */
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

/** Updates state.currentJobId when the current URL matches a Ready job. */
function syncCurrentJobFromQueues() {
  const readyJob = currentReadyJob();
  state.currentJobId = readyJob?.jobId ?? null;
}

/** Finds the Ready job corresponding to the current tab URL. */
function currentReadyJob() {
  const currentUrl = normalizeActionUrl(state.currentTab?.url);
  if (!currentUrl) return null;
  return state.queues.ready.find((item) => normalizeActionUrl(item.url) === currentUrl) ?? null;
}

/** Normalizes URLs for current-page-to-job matching without dropping query identity. */
function normalizeActionUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return rawUrl.replace(/\/$/, '');
  }
}

/** Reads the current browser tab and refreshes page-specific state. */
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
  await refreshArtifactStatus();
}

/** Checks duplicate status and aggregator warnings for the active page. */
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
          inboxId: result.inboxId,
          jobId: result.jobId,
          status: result.status,
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

/** Stores current-page status and immediately re-renders the relevant controls. */
function setCurrentPageStatus(nextStatus) {
  state.currentPageStatus = nextStatus;
  renderCurrentPageStatus();
}

/** Renders the duplicate import notice with a clickable source link. */
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

/** Placeholder for future kanban Next behavior. */
async function focusNext(column) {
  void column;
  log(QUEUE_COMING_SOON_MESSAGE);
}

/** Opens a generated resume or cover-letter preview in a new tab. */
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

/** Switches the UI into one-shot regenerate mode for a resume or cover letter. */
function setArtifactEditMode(kind) {
  state.view = 'artifact-edit';
  state.activeArtifactKind = kind;
  const label = kind === 'resume' ? 'Resume' : 'Cover Letter';
  els.artifactEditTitle.textContent = `Edit ${label}`;
  setButtonLabel(els.regenerateArtifactButton, `Regenerate ${label}`);
  els.artifactEditPromptInput.value = '';
  renderView();
}

/** Refreshes artifact readiness for the current Ready job. */
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

/** Captures the active page DOM and saves it as a raw inbox item. */
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
    if (result.status !== 'duplicate') {
      state.inbox = { hasRaw: true, rawCount: state.inbox.rawCount + 1 };
    }
    log(result.status === 'duplicate'
      ? `Already in wolf inbox: ${result.inboxId ?? 'existing item'}`
      : `Imported page to wolf inbox: ${result.inboxId ?? 'new item'}`);
    await refreshInboxStatus();
    await refreshCurrentPageStatus();
  } catch (err) {
    const message = importErrorMessage(err);
    setButtonState(els.importCurrentPageButton, 'Import Failed', false);
    log(`Import failed: ${message}`);
  } finally {
    resetImportButtonLater();
  }
}

/** Deletes the current page's imported inbox item after a native confirmation. */
async function deleteCurrentImport() {
  if (!ensureReady()) return;
  const detail = state.currentPageStatus.detail;
  const inboxId = detail?.inboxId;
  if (state.currentPageStatus.kind !== 'duplicate' || typeof inboxId !== 'string') {
    log('No imported inbox item is selected for this page.');
    return;
  }

  const title = typeof detail.title === 'string' ? detail.title : 'this page';
  const confirmed = window.confirm(`Delete this import from wolf inbox?\n\n${title}`);
  if (!confirmed) {
    log('Delete import cancelled.');
    return;
  }

  setButtonState(els.deleteImportButton, '…', true);
  try {
    await deleteJson(`/api/inbox/items/${encodeURIComponent(inboxId)}`);
    log(`Deleted import: ${inboxId}`);
    setCurrentPageStatus({ kind: 'normal', detail: null });
    await refreshInboxStatus();
    await refreshQueues();
    await refreshCurrentPageStatus();
  } catch (err) {
    log(`Delete import failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    renderActionAvailability();
  }
}

/** Collects a bounded DOM/text snapshot from the current tab. */
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

/** Requests host permission for the active tab before reading page contents. */
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

/** Converts a URL to a Chrome host-permission pattern. */
function hostPermissionPattern(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.protocol}//${parsed.host}/*`;
  } catch {
    return null;
  }
}

/** Converts Chrome scripting/permission errors into user-facing activity text. */
function importErrorMessage(err) {
  const message = err instanceof Error ? err.message : String(err);
  const runtimeMessage = chromeApi?.runtime?.lastError?.message;
  if (message.includes('Cannot access contents of url')) {
    return `Cannot import this tab after site access was granted. Chrome said: ${message}`;
  }
  if (runtimeMessage) return `${message} Chrome runtime said: ${runtimeMessage}`;
  return message;
}

/** Starts a batch Process Inbox run for all raw imported items. */
async function processInboxWithAi() {
  if (!ensureReady()) return;
  if (!state.inbox.hasRaw) {
    log('Import at least one page before processing the inbox.');
    renderActionAvailability();
    return;
  }
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
      state.inbox = { hasRaw: false, rawCount: 0 };
      renderActionAvailability();
      log('No raw inbox items to process.');
      return;
    }
    if (result.status === 'completed') {
      setButtonState(els.processInboxButton, 'Processed', false);
      state.inbox = { hasRaw: false, rawCount: 0 };
      log(`Inbox processed: ${result.itemCount ?? 0} item(s), ${result.jobIds?.length ?? 0} job(s) created.`);
      await refreshQueues();
      await refreshInboxStatus();
      return;
    }
    setButtonState(els.processInboxButton, 'Queued', false);
    state.inbox = { hasRaw: false, rawCount: 0 };
    log(`Inbox processing queued: ${result.itemCount ?? 0} item(s), ${result.shardCount ?? 0} shard(s).`);
    await refreshInboxStatus();
    if (result.batchId) {
      startRunPolling(result.batchId, {
        button: els.processInboxButton,
        stepProgress: '2/3',
        stepKicker: 'Step 2 of 3',
        completeLabel: 'Processed',
        failedLabel: 'Process Failed',
        resetLabel: 'Process Inbox',
        disableOnComplete: false,
      });
      await pollRunStatus(result.batchId);
    }
  } catch (err) {
    setButtonState(els.processInboxButton, 'Queue Failed', false);
    setConnection('disconnected', err instanceof Error ? err.message : String(err));
  } finally {
    resetButtonLabelLater(els.processInboxButton, 'Process Inbox');
  }
}

/** Starts a one-item Process run for the current imported page. */
async function processCurrentPageWithAi() {
  if (!ensureReady()) return;
  const detail = state.currentPageStatus.detail;
  const inboxId = detail?.inboxId;
  if (
    state.currentPageStatus.kind !== 'duplicate' ||
    typeof inboxId !== 'string' ||
    detail.status !== 'raw'
  ) {
    log('Import this page first, then process it.');
    renderActionAvailability();
    return;
  }
  const confirmed = window.confirm(
    'Process this imported page into a Ready job? This may use a paid AI batch call.',
  );
  if (!confirmed) {
    log('Single-page processing cancelled.');
    return;
  }

  setButtonState(els.processCurrentPageButton, 'Queueing...', true);
  try {
    const result = await postJson(`/api/inbox/items/${encodeURIComponent(inboxId)}/process`, {
      provider: 'anthropic',
      shardSize: 1,
    });
    if (result.status === 'empty') {
      setButtonState(els.processCurrentPageButton, 'Nothing to Process', false);
      log('This import is not raw anymore.');
      await refreshCurrentPageStatus();
      return;
    }
    if (result.status === 'completed') {
      setButtonState(els.processCurrentPageButton, 'Processed', false);
      log(`Page processed: ${result.jobIds?.length ?? 0} job(s) created.`);
      await refreshQueues();
      await refreshInboxStatus();
      await refreshCurrentPageStatus();
      return;
    }
    setButtonState(els.processCurrentPageButton, 'Queued', false);
    log(`Single-page processing queued: ${result.batchId ?? 'run pending'}`);
    await refreshInboxStatus();
    await refreshCurrentPageStatus();
    if (result.batchId) {
      startRunPolling(result.batchId, {
        button: els.processCurrentPageButton,
        stepProgress: '2/3',
        stepKicker: 'Step 2 of 3',
        completeLabel: 'Processed',
        failedLabel: 'Process Failed',
        resetLabel: 'Process this page',
        disableOnComplete: false,
      });
      await pollRunStatus(result.batchId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setButtonState(els.processCurrentPageButton, 'Process Failed', false);
    log(`Single-page processing failed: ${message}`);
    resetButtonLabelLater(els.processCurrentPageButton, 'Process this page');
  }
}

/** Starts a batch tailor run for all untailored Ready jobs. */
async function batchTailor() {
  if (!ensureReady()) return;
  const jobIds = state.queues.ready.map((item) => item.jobId ?? item.id).filter(Boolean);
  if (jobIds.length === 0) {
    log('No Ready jobs yet. Process Inbox first, then try Batch Tailor.');
    renderBatchTailorState();
    return;
  }
  const confirmed = window.confirm(
    `Start batch tailoring for ${jobIds.length} Ready job(s)? This may use paid AI batch API calls.`,
  );
  if (!confirmed) {
    log('Batch tailor cancelled.');
    return;
  }

  setButtonState(els.batchTailorButton, 'Queueing...', true);
  try {
    const result = await postJson('/api/tailor/batch', { jobIds });
    setButtonState(els.batchTailorButton, 'Batch Tailoring...', true);
    log(`Batch tailor started: ${result.runId ?? 'run pending'}`);
    if (result.runId) {
      startRunPolling(result.runId, {
        button: els.batchTailorButton,
        stepProgress: '3/3',
        stepKicker: 'Step 3 of 3',
        completeLabel: 'Batch Ready',
        failedLabel: 'Batch Failed',
        resetLabel: 'Batch Tailor',
        disableOnComplete: false,
      });
      await pollRunStatus(result.runId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setButtonState(els.batchTailorButton, 'Batch Failed', false);
    log(`Batch tailor failed to start: ${message}`);
    resetButtonLabelLater(els.batchTailorButton, 'Batch Tailor');
  }
}

/** Opens the one-shot tailor prompt or sends it for the current Ready job. */
async function tailorThisJobInstantly() {
  if (!ensureReady()) return;
  syncCurrentJobFromQueues();
  if (!state.currentJobId) {
    log('This page is not a Ready job yet. Import it, then Process Inbox.');
    renderActionAvailability();
    return;
  }

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
    if (result.runId) {
      startRunPolling(result.runId, {
        button: els.tailorInstantButton,
        stepProgress: '3/3',
        stepKicker: 'Step 3 of 3',
        completeLabel: 'Tailored',
        failedLabel: 'Tailor Failed',
        resetLabel: 'Tailor this job instantly',
      });
    }
  } catch (err) {
    els.tailorPromptBox.hidden = true;
    const message = err instanceof Error ? err.message : String(err);
    setButtonState(els.tailorInstantButton, 'Tailor TODO', false);
    log(`Instant tailor unavailable: ${message}`);
    resetButtonLabelLater(els.tailorInstantButton, 'Tailor this job instantly');
  }
}

/** Stub handler for future Stagehand-based form filling. */
async function autofillThisPage() {
  log(`Autofill is not implemented yet. ${AUTOFILL_BLOCKED_REASON}`);
}

/** Stub handler for future outreach draft generation. */
async function generateOutreachDraft() {
  log(`Outreach draft is not implemented yet. ${OUTREACH_BLOCKED_REASON}`);
}

/** Stub handler for future processed-job cleanup. */
async function clearProcessedJob() {
  log(`Clear processed job is not implemented yet. ${PROCESS_DELETE_BLOCKED_REASON}`);
}

/** Stub handler for future tailor-artifact cleanup/reset. */
async function clearTailorArtifacts() {
  log(`Clear tailor artifacts is not implemented yet. ${TAILOR_DELETE_BLOCKED_REASON}`);
}

/** Sends a one-shot regenerate request for the open resume or cover letter. */
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
    if (result.runId) {
      startRunPolling(result.runId, {
        button: els.regenerateArtifactButton,
        stepProgress: '3/3',
        stepKicker: 'Step 3 of 3',
        completeLabel: `${label} Ready`,
        failedLabel: 'Regenerate Failed',
        resetLabel: `Regenerate ${label}`,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setButtonState(els.regenerateArtifactButton, 'Regenerate TODO', false);
    log(`${label} regeneration unavailable: ${message}`);
    resetButtonLabelLater(els.regenerateArtifactButton, `Regenerate ${label}`);
  }
}

/** Manually checks the active run status, or explains that no run exists. */
async function refreshActiveRunOrArtifacts() {
  if (state.activeRunId) {
    await pollRunStatus(state.activeRunId);
    return;
  }
  log('No active AI run to check yet.');
  renderActionAvailability();
}

/** Starts 5s local polling for one queued background AI run. */
function startRunPolling(runId, ui = null) {
  state.activeRunId = runId;
  state.activeRunUi = ui;
  renderActionAvailability();
  if (state.runPollTimer) clearInterval(state.runPollTimer);
  state.runPollTimer = setInterval(() => {
    pollRunStatus(runId).catch((err) => {
      log(`Run status check failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, RUN_POLL_MS);
}

/** Reads one run status and updates artifacts, buttons, and queue state. */
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
    if (body.status === 'failed') {
      log(body.error ? `Run failed: ${body.error}` : 'Run failed.');
      if (body.type === 'tailor') {
        log('For failed tailor jobs, open the job and use Tailor this job instantly.');
      } else if (body.type === 'inbox_promote') {
        log('For failed inbox items, import that page again, then run Process Inbox.');
      }
    }
    renderCompletedRunUi(body.status);
    stopRunPolling();
    await refreshQueues();
    await refreshArtifactStatus();
  }
}

/** Restores the button connected to a completed or failed run. */
function renderCompletedRunUi(status) {
  const ui = state.activeRunUi;
  if (!ui?.button) return;
  if (status === 'ready') {
    setButtonState(ui.button, ui.completeLabel ?? 'Ready', ui.disableOnComplete ?? true);
    return;
  }
  setButtonState(ui.button, ui.failedLabel ?? 'Failed', false);
  resetButtonLabelLater(ui.button, ui.resetLabel ?? currentButtonText(ui.button));
}

/** Stops local run polling and clears active run UI metadata. */
function stopRunPolling() {
  if (state.runPollTimer) clearInterval(state.runPollTimer);
  state.runPollTimer = null;
  state.activeRunId = null;
  state.activeRunUi = null;
  renderActionAvailability();
}

/** Saves the config form through wolf serve. */
async function saveConfig() {
  setButtonState(els.saveConfigButton, 'Saving...', true);
  try {
    const result = await postJson('/api/config', readConfigForm());
    if (result.status === 'todo') {
      log(result.todo ?? 'Config write is not implemented yet.');
    } else {
      renderConfigForm(result);
      log('Config saved to wolf.toml.');
    }
  } catch (err) {
    log(`Config save unavailable: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    setButtonState(els.saveConfigButton, 'Save Config', false);
  }
}

/** Resets wolf.toml to defaults after native confirmation. */
async function resetConfig() {
  const confirmed = window.confirm('Reset wolf.toml settings to wolf defaults? This will create a backup first.');
  if (!confirmed) {
    log('Config reset cancelled.');
    return;
  }

  setButtonState(els.resetConfigButton, 'Resetting...', true);
  try {
    const result = await postJson('/api/config/reset', {});
    renderConfigForm(result);
    log('Config reset to wolf defaults.');
  } catch (err) {
    log(`Config reset unavailable: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    setButtonState(els.resetConfigButton, 'Reset Config', false);
  }
}

/** Copies a loaded config object into the settings form. */
function renderConfigForm(config) {
  els.configDefaultInput.value = config.default ?? 'default';
  els.configHuntMinScoreInput.value = String(config.hunt?.minScore ?? 0.5);
  els.configHuntMaxResultsInput.value = String(config.hunt?.maxResults ?? 50);
  els.configTailorModelInput.value = config.tailor?.model ?? 'anthropic/claude-sonnet-4-6';
  els.configCoverLetterToneInput.value = config.tailor?.defaultCoverLetterTone ?? 'professional';
  els.configScoreModelInput.value = config.score?.model ?? 'anthropic/claude-sonnet-4-6';
  els.configReachModelInput.value = config.reach?.model ?? 'anthropic/claude-sonnet-4-6';
  els.configEmailToneInput.value = config.reach?.defaultEmailTone ?? 'professional';
  els.configMaxEmailsPerDayInput.value = String(config.reach?.maxEmailsPerDay ?? 10);
  els.configFillModelInput.value = config.fill?.model ?? 'anthropic/claude-haiku-4-5-20251001';
}

/** Reads and validates the settings form into the HTTP config payload. */
function readConfigForm() {
  const minScore = Number(els.configHuntMinScoreInput.value.trim());
  const maxResults = Number(els.configHuntMaxResultsInput.value.trim());
  const maxEmailsPerDay = Number(els.configMaxEmailsPerDayInput.value.trim());

  if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) {
    throw new Error('Hunt minimum score must be a number from 0 to 1.');
  }
  if (!Number.isInteger(maxResults) || maxResults < 1) {
    throw new Error('Hunt max results must be a positive integer.');
  }
  if (!Number.isInteger(maxEmailsPerDay) || maxEmailsPerDay < 1) {
    throw new Error('Reach max emails per day must be a positive integer.');
  }

  return {
    default: els.configDefaultInput.value.trim() || 'default',
    hunt: { minScore, maxResults },
    tailor: {
      model: els.configTailorModelInput.value.trim(),
      defaultCoverLetterTone: els.configCoverLetterToneInput.value.trim() || 'professional',
    },
    score: { model: els.configScoreModelInput.value.trim() },
    reach: {
      model: els.configReachModelInput.value.trim(),
      defaultEmailTone: els.configEmailToneInput.value.trim() || 'professional',
      maxEmailsPerDay,
    },
    fill: { model: els.configFillModelInput.value.trim() },
  };
}

/** Returns all known job ids from the placeholder queues. */
function collectKnownJobIds() {
  return [...new Set(Object.values(state.queues)
    .flat()
    .map((item) => item.jobId)
    .filter(Boolean))];
}

/** Ensures the daemon and browser are ready before running a protected action. */
function ensureReady() {
  if (isRuntimeReady()) return true;
  log(runtimeBlockReason());
  return false;
}

/** Sets button text and disabled state in one place. */
function setButtonState(button, label, disabled) {
  setButtonLabel(button, label);
  button.disabled = disabled;
}

/** Restores a temporary button label after a short visible delay. */
function resetButtonLabelLater(button, label) {
  setTimeout(() => {
    setButtonLabel(button, label);
    button.disabled = false;
    renderDaemonActionState();
    renderArtifactButtons();
    renderActionAvailability();
  }, 1_800);
}

/** Adds warning badges to visible controls for deliberately unfinished features. */
function renderIncompleteBadges() {
  setButtonLabel(els.batchTailorButton, currentButtonText(els.batchTailorButton) || 'Batch Tailor');
  setButtonLabel(els.autofillQuickButton, currentButtonText(els.autofillQuickButton) || 'Autofill this page');
  setButtonLabel(els.outreachDraftButton, currentButtonText(els.outreachDraftButton) || 'Generate outreach draft');
}

/** Sets a button label and appends a warning badge when the action is incomplete. */
function setButtonLabel(button, label) {
  button.replaceChildren(document.createTextNode(label));
  const reason = incompleteReason(button);
  if (!reason) return;

  const badge = document.createElement('span');
  badge.className = 'incomplete-badge';
  badge.textContent = '⚠️';
  badge.title = `${INCOMPLETE_TOOLTIP}: ${reason}`;
  badge.setAttribute('aria-label', `${INCOMPLETE_TOOLTIP}: ${reason}`);
  button.append(' ', badge);
}

/** Reads the text label from a button while ignoring warning-badge elements. */
function currentButtonText(button) {
  return [...button.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join('')
    .trim();
}

/** Returns the unfinished-feature reason for a button, or null when implemented. */
function incompleteReason(button) {
  if (button === els.batchTailorButton) {
    return null;
  }
  if (button === els.autofillQuickButton) {
    return AUTOFILL_BLOCKED_REASON;
  }
  if (button === els.outreachDraftButton) {
    return OUTREACH_BLOCKED_REASON;
  }
  return null;
}

/** Restores the import button after transient Imported/Failed labels. */
function resetImportButtonLater() {
  setTimeout(() => {
    els.importCurrentPageButton.disabled = false;
    renderDaemonActionState();
    renderCurrentPageStatus();
    renderActionAvailability();
  }, 1_800);
}

/** Sends JSON to wolf serve and treats TODO route responses as normal payloads. */
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

/** Reads JSON from wolf serve and treats TODO route responses as normal payloads. */
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

/** Sends a DELETE request to wolf serve for removable companion resources. */
async function deleteJson(path) {
  const res = await fetchWithTimeout(`${daemonBase()}${path}`, {
    method: 'DELETE',
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok) {
    if (parsed?.status === 'todo') return parsed;
    throw new Error(parsed?.error ?? parsed?.todo ?? `HTTP ${res.status}`);
  }
  return parsed ?? {};
}

/** Prepends a short user-visible activity message. */
function log(message) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  els.activityLog.prepend(li);
  while (els.activityLog.children.length > 6) {
    els.activityLog.lastElementChild?.remove();
  }
}

/** Detects job aggregator URLs where company apply pages are usually better input. */
function detectAggregatorPlatform(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return AGGREGATOR_PLATFORMS.find((platform) => platform.matches(url)) ?? null;
  } catch {
    return null;
  }
}

/** True when a hostname is exactly a suffix or one of its subdomains. */
function hostnameEndsWith(hostname, suffix) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}
