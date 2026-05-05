import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCompanionState } from '../state/StateContext';
import { useDaemonApi } from './useDaemonApi';
import { usePageSnapshot } from './usePageSnapshot';
import { useCurrentTab } from './useCurrentTab';
import { usePersistedPort } from './useChromeStorage';
import { useDaemonHeartbeat } from './useDaemonConnection';
import { useRunPolling } from './useRunPolling';
import {
  hasChromeApi,
  getChromeApi,
  detectAggregatorPlatform,
  normalizeActionUrl,
  isValidPort,
  errorMessage,
  TRANSIENT_LABEL_MS,
} from '../utils';
import type {
  ActiveRunUi,
  ArtifactKind,
  CurrentPageStatus,
  QueueItem,
  QueuesState,
  RuntimeState,
} from '../state/types';

export interface CompanionActions {
  port: string;
  reconnect: (port: string) => Promise<void>;
  openWolfBrowser: () => Promise<void>;
  openConfigPanel: () => Promise<void>;
  closeConfigPanel: () => void;
  saveConfig: (config: ConfigPayload) => Promise<void>;
  resetConfig: () => Promise<void>;
  importCurrentPage: () => Promise<void>;
  deleteCurrentImport: () => Promise<void>;
  processCurrentPage: () => Promise<void>;
  processInbox: () => Promise<void>;
  tailorInstantly: () => Promise<void>;
  batchTailor: () => Promise<void>;
  openPreview: (kind: ArtifactKind) => Promise<void>;
  regenerateArtifact: () => Promise<void>;
  refreshActiveRun: () => Promise<void>;
  closeArtifactEdit: () => void;
  setPromptText: (which: 'tailor' | 'fill' | 'artifactEdit', text: string) => void;
  refresh: {
    runtime: () => Promise<void>;
    queues: () => Promise<void>;
    inbox: () => Promise<void>;
    artifacts: () => Promise<void>;
    pageStatus: () => Promise<void>;
    currentTab: () => Promise<void>;
  };
}

export interface ConfigPayload {
  default: string;
  hunt: { minScore: number; maxResults: number };
  tailor: { model: string; defaultCoverLetterTone: string };
  score: { model: string };
  reach: { model: string; defaultEmailTone: string; maxEmailsPerDay: number };
  fill: { model: string };
}

interface RawApiQueues {
  filling?: unknown[];
  ready?: unknown[];
  stuck?: unknown[];
}

/**
 * The cohesive set of side-panel actions. This hook composes all the
 * smaller hooks (HTTP, chrome APIs, current tab) and returns user-facing
 * handlers + refreshers. App.tsx wires these to event handlers.
 */
export function useCompanionActions(): CompanionActions {
  const { state, dispatch, log } = useCompanionState();
  const { port, setPort } = usePersistedPort();
  const api = useDaemonApi(port);
  const snapshot = usePageSnapshot();
  const tab = useCurrentTab();

  // Page-status request sequencing protects against stale duplicate-check
  // responses overwriting newer ones when the user switches tabs quickly.
  const pageStatusSeqRef = useRef(0);

  // Stable refs to live state and api. Inside async handlers we read state
  // through stateRef to avoid closure staleness while still keeping the
  // hook callbacks stable.
  const stateRef = useRef(state);
  stateRef.current = state;

  const apiRef = useRef(api);
  apiRef.current = api;

  // ---- refreshers -------------------------------------------------------

  const refreshRuntimeStatus = useCallback(async () => {
    const runtime = await apiRef.current.getJson<RuntimeState>('/api/runtime/status');
    dispatch({ type: 'set-runtime', runtime });
  }, [dispatch]);

  const refreshInboxStatus = useCallback(async () => {
    if (stateRef.current.connection.status !== 'connected') {
      dispatch({ type: 'set-inbox', inbox: { hasRaw: false, rawCount: 0 } });
      return;
    }
    try {
      const result = await apiRef.current.getJson<{ hasRaw?: boolean; rawCount?: number }>('/api/inbox/status');
      const rawCount = Number(result.rawCount ?? 0);
      dispatch({
        type: 'set-inbox',
        inbox: { hasRaw: Boolean(result.hasRaw), rawCount },
      });
    } catch (err) {
      dispatch({ type: 'set-inbox', inbox: { hasRaw: false, rawCount: 0 } });
      log(`Could not refresh inbox status: ${errorMessage(err)}`);
    }
  }, [dispatch, log]);

  const refreshQueues = useCallback(async () => {
    const ready = isRuntimeReady(stateRef.current);
    if (!ready) {
      dispatch({ type: 'set-queues', queues: { filling: [], ready: [], stuck: [] } });
      dispatch({ type: 'set-tailor-counts', tailor: { untailoredJobCount: 0 } });
      dispatch({ type: 'set-current-job-id', jobId: null });
      return;
    }
    try {
      const result = await apiRef.current.getJson<{ queues?: RawApiQueues; counts?: { untailoredJobs?: number } }>('/api/tabs');
      const queues = normalizeQueues(result.queues ?? {});
      dispatch({ type: 'set-queues', queues });
      dispatch({
        type: 'set-tailor-counts',
        tailor: {
          untailoredJobCount: Number(result.counts?.untailoredJobs ?? queues.ready.length),
        },
      });
      const jobId = matchCurrentJob(stateRef.current.currentTab?.url ?? null, queues);
      dispatch({ type: 'set-current-job-id', jobId });
    } catch (err) {
      dispatch({ type: 'set-queues', queues: { filling: [], ready: [], stuck: [] } });
      dispatch({ type: 'set-tailor-counts', tailor: { untailoredJobCount: 0 } });
      log(`Could not refresh Ready jobs: ${errorMessage(err)}`);
    }
  }, [dispatch, log]);

  const refreshArtifactStatus = useCallback(async () => {
    const s = stateRef.current;
    if (s.connection.status !== 'connected' || !s.currentJobId) {
      dispatch({
        type: 'set-artifacts',
        artifacts: {
          resume: { status: 'not_ready', url: null },
          coverLetter: { status: 'not_ready', url: null },
        },
      });
      return;
    }
    try {
      const res = await apiRef.current.fetchWithTimeout(`/api/jobs/${encodeURIComponent(s.currentJobId)}/artifacts`);
      const body = await res.json().catch(() => ({})) as {
        resume?: { status: string; url: string | null };
        coverLetter?: { status: string; url: string | null };
        status?: string;
        todo?: string;
      };
      dispatch({
        type: 'set-artifacts',
        artifacts: {
          resume: body.resume ?? { status: 'not_ready', url: null },
          coverLetter: body.coverLetter ?? { status: 'not_ready', url: null },
        },
      });
      if (!res.ok && body.status === 'todo') {
        log(body.todo ?? 'Artifact readiness is not implemented yet.');
      }
    } catch (err) {
      dispatch({
        type: 'set-artifacts',
        artifacts: {
          resume: { status: 'not_ready', url: null },
          coverLetter: { status: 'not_ready', url: null },
        },
      });
      log(`Artifact readiness check failed: ${errorMessage(err)}`);
    }
  }, [dispatch, log]);

  const refreshCurrentPageStatus = useCallback(async () => {
    const requestId = ++pageStatusSeqRef.current;
    const s = stateRef.current;
    const currentUrl = s.currentTab?.url ?? null;
    if (!currentUrl || !isRuntimeReady(s)) {
      setPageStatus({ kind: 'normal', detail: null });
      return;
    }
    const aggregator = detectAggregatorPlatform(currentUrl);
    try {
      const res = await apiRef.current.fetchWithTimeout(
        `/api/inbox/duplicate-check?url=${encodeURIComponent(currentUrl)}`,
      );
      if (requestId !== pageStatusSeqRef.current) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json() as {
        duplicate?: boolean;
        inboxId?: string;
        jobId?: string | null;
        status?: string;
        title?: string;
        url?: string;
      };
      if (result.duplicate) {
        setPageStatus({
          kind: 'duplicate',
          detail: {
            inboxId: result.inboxId ?? '',
            jobId: result.jobId ?? null,
            status: result.status ?? '',
            title: result.title ?? 'Untitled page',
            url: result.url ?? currentUrl,
          },
        });
        return;
      }
    } catch (err) {
      if (requestId !== pageStatusSeqRef.current) return;
      log(`Duplicate check failed: ${errorMessage(err)}`);
    }
    if (aggregator) {
      setPageStatus({
        kind: 'aggregator',
        detail: `This looks like a ${aggregator.name} listing. If possible, open the company application page and import that page instead.`,
      });
      return;
    }
    setPageStatus({ kind: 'normal', detail: null });

    function setPageStatus(status: CurrentPageStatus) {
      dispatch({ type: 'set-current-page-status', status });
    }
  }, [dispatch, log]);

  // ---- ensure-ready guard ---------------------------------------------

  const ensureReady = useCallback((): boolean => {
    if (isRuntimeReady(stateRef.current)) return true;
    log(runtimeBlockReason(stateRef.current));
    return false;
  }, [log]);

  // ---- transient label helper ------------------------------------------

  const overrideLater = useCallback((buttonId: string, label: string) => {
    dispatch({
      type: 'override-button',
      buttonId,
      override: { label, expiresAt: Date.now() + TRANSIENT_LABEL_MS },
    });
    setTimeout(() => {
      dispatch({ type: 'override-button', buttonId, override: null });
    }, TRANSIENT_LABEL_MS);
  }, [dispatch]);

  // ---- user actions ----------------------------------------------------

  const reconnect = useCallback(async (newPort: string) => {
    if (!isValidPort(newPort)) {
      dispatch({
        type: 'set-connection',
        connection: { status: 'disconnected', detail: 'Port must be 4-5 digits.' },
      });
      log('Port must be 4-5 digits.');
      return;
    }
    await setPort(newPort);
    dispatch({
      type: 'set-connection',
      connection: { status: 'idle', detail: 'Pinging wolf serve...' },
    });
    log('Pinging wolf serve...');
    try {
      const body = await apiRef.current.ping();
      dispatch({
        type: 'set-connection',
        connection: { status: 'connected', detail: `Connected: wolf ${body.version ?? 'unknown'}` },
      });
      log(`Connected: wolf ${body.version ?? 'unknown'}`);
      await refreshRuntimeStatus();
      await refreshQueues();
      await refreshInboxStatus();
      await refreshCurrentPageStatus();
      await refreshArtifactStatus();
    } catch (err) {
      const detail = errorMessage(err);
      dispatch({ type: 'set-connection', connection: { status: 'disconnected', detail } });
      log(detail);
    }
  }, [dispatch, log, setPort, refreshRuntimeStatus, refreshQueues, refreshInboxStatus, refreshCurrentPageStatus, refreshArtifactStatus]);

  const openWolfBrowser = useCallback(async () => {
    const s = stateRef.current;
    if (s.connection.status !== 'connected') {
      log('Connect to wolf serve first.');
      return;
    }
    overrideLater('openBrowser', 'Opening...');
    try {
      await apiRef.current.postJson('/api/browser/open', {});
      await refreshRuntimeStatus();
      await refreshQueues();
      log('Wolf browser is ready. Use that window for application pages.');
    } catch (err) {
      log(`Wolf browser could not open: ${errorMessage(err)}`);
    }
  }, [overrideLater, refreshRuntimeStatus, refreshQueues, log]);

  const openConfigPanel = useCallback(async () => {
    dispatch({ type: 'set-view', view: 'config' });
    if (stateRef.current.connection.status !== 'connected') {
      log('Connect to wolf serve to load wolf.toml config.');
      return;
    }
    try {
      const body = await apiRef.current.getJson<{ status?: string; todo?: string } & ConfigPayload>('/api/config');
      if (body.status === 'todo') {
        log(body.todo ?? 'Config service is not implemented yet.');
        return;
      }
      // Config form is uncontrolled; the component reads it via a ref-based
      // hydration pattern when it mounts. We dispatch a tiny event below.
      window.dispatchEvent(new CustomEvent<ConfigPayload>('wolf-config-loaded', { detail: body }));
    } catch (err) {
      log(`Config load unavailable: ${errorMessage(err)}`);
    }
  }, [dispatch, log]);

  const closeConfigPanel = useCallback(() => {
    dispatch({ type: 'set-view', view: 'main' });
  }, [dispatch]);

  const saveConfig = useCallback(async (config: ConfigPayload) => {
    overrideLater('saveConfig', 'Saving...');
    try {
      const result = await apiRef.current.postJson<{ status?: string; todo?: string } & ConfigPayload>('/api/config', config);
      if (result.status === 'todo') {
        log(result.todo ?? 'Config write is not implemented yet.');
      } else {
        window.dispatchEvent(new CustomEvent<ConfigPayload>('wolf-config-loaded', { detail: result }));
        log('Config saved to wolf.toml.');
      }
    } catch (err) {
      log(`Config save unavailable: ${errorMessage(err)}`);
    }
  }, [overrideLater, log]);

  const resetConfig = useCallback(async () => {
    const confirmed = window.confirm('Reset wolf.toml settings to wolf defaults? This will create a backup first.');
    if (!confirmed) {
      log('Config reset cancelled.');
      return;
    }
    overrideLater('resetConfig', 'Resetting...');
    try {
      const result = await apiRef.current.postJson<ConfigPayload>('/api/config/reset', {});
      window.dispatchEvent(new CustomEvent<ConfigPayload>('wolf-config-loaded', { detail: result }));
      log('Config reset to wolf defaults.');
    } catch (err) {
      log(`Config reset unavailable: ${errorMessage(err)}`);
    }
  }, [overrideLater, log]);

  const importCurrentPage = useCallback(async () => {
    if (!ensureReady()) return;
    const s = stateRef.current;
    if (s.currentPageStatus.kind === 'duplicate') {
      log('Duplicate page detected. Import skipped.');
      return;
    }
    if (s.currentPageStatus.kind === 'aggregator') {
      log('Aggregator listing detected. Import is allowed, but the company application page is usually better.');
    }
    overrideLater('import', 'Importing...');
    try {
      const tabId = s.currentTab?.id ?? null;
      const url = s.currentTab?.url ?? '';
      const snap = await snapshot({ tabId, url });
      const result = await apiRef.current.postJson<{ status?: string; inboxId?: string }>('/api/inbox/items', {
        kind: 'manual_page',
        source: 'wolf_companion',
        ...snap,
      });
      const isDup = result.status === 'duplicate';
      overrideLater('import', isDup ? 'Already Imported' : 'Imported');
      if (!isDup) {
        dispatch({ type: 'set-inbox', inbox: { hasRaw: true, rawCount: s.inbox.rawCount + 1 } });
      }
      log(isDup
        ? `Already in wolf inbox: ${result.inboxId ?? 'existing item'}`
        : `Imported page to wolf inbox: ${result.inboxId ?? 'new item'}`);
      await refreshInboxStatus();
      await refreshCurrentPageStatus();
    } catch (err) {
      overrideLater('import', 'Import Failed');
      log(`Import failed: ${errorMessage(err)}`);
    }
  }, [ensureReady, overrideLater, snapshot, log, dispatch, refreshInboxStatus, refreshCurrentPageStatus]);

  const deleteCurrentImport = useCallback(async () => {
    if (!ensureReady()) return;
    const s = stateRef.current;
    if (s.currentPageStatus.kind !== 'duplicate') {
      log('No imported inbox item is selected for this page.');
      return;
    }
    const inboxId = s.currentPageStatus.detail.inboxId;
    if (!inboxId) {
      log('No imported inbox item is selected for this page.');
      return;
    }
    const title = s.currentPageStatus.detail.title || 'this page';
    const confirmed = window.confirm(`Delete this import from wolf inbox?\n\n${title}`);
    if (!confirmed) {
      log('Delete import cancelled.');
      return;
    }
    overrideLater('deleteImport', '…');
    try {
      await apiRef.current.deleteJson(`/api/inbox/items/${encodeURIComponent(inboxId)}`);
      log(`Deleted import: ${inboxId}`);
      dispatch({ type: 'set-current-page-status', status: { kind: 'normal', detail: null } });
      await refreshInboxStatus();
      await refreshQueues();
      await refreshCurrentPageStatus();
    } catch (err) {
      log(`Delete import failed: ${errorMessage(err)}`);
    }
  }, [ensureReady, overrideLater, log, dispatch, refreshInboxStatus, refreshQueues, refreshCurrentPageStatus]);

  const processCurrentPage = useCallback(async () => {
    if (!ensureReady()) return;
    const s = stateRef.current;
    if (s.currentPageStatus.kind !== 'duplicate') {
      log('Import this page first, then process it.');
      return;
    }
    const inboxId = s.currentPageStatus.detail.inboxId;
    if (!inboxId || s.currentPageStatus.detail.status !== 'raw') {
      log('Import this page first, then process it.');
      return;
    }
    const confirmed = window.confirm(
      'Process this imported page into a Ready job? This may use a paid AI batch call.',
    );
    if (!confirmed) {
      log('Single-page processing cancelled.');
      return;
    }
    overrideLater('processCurrentPage', 'Queueing...');
    try {
      const result = await apiRef.current.postJson<{
        status?: string;
        batchId?: string;
        jobIds?: string[];
      }>(`/api/inbox/items/${encodeURIComponent(inboxId)}/process`, {
        provider: 'anthropic',
        shardSize: 1,
      });
      if (result.status === 'empty') {
        overrideLater('processCurrentPage', 'Nothing to Process');
        log('This import is not raw anymore.');
        await refreshCurrentPageStatus();
        return;
      }
      if (result.status === 'completed') {
        overrideLater('processCurrentPage', 'Processed');
        log(`Page processed: ${result.jobIds?.length ?? 0} job(s) created.`);
        await refreshQueues();
        await refreshInboxStatus();
        await refreshCurrentPageStatus();
        return;
      }
      overrideLater('processCurrentPage', 'Queued');
      log(`Single-page processing queued: ${result.batchId ?? 'run pending'}`);
      await refreshInboxStatus();
      await refreshCurrentPageStatus();
      if (result.batchId) startActiveRun(result.batchId, {
        buttonId: 'processCurrentPage',
        stepProgress: '2/3',
        stepKicker: 'Step 2 of 3',
        completeLabel: 'Processed',
        failedLabel: 'Process Failed',
        resetLabel: 'Process this page',
      });
    } catch (err) {
      overrideLater('processCurrentPage', 'Process Failed');
      log(`Single-page processing failed: ${errorMessage(err)}`);
    }
  }, [ensureReady, overrideLater, log, refreshQueues, refreshInboxStatus, refreshCurrentPageStatus]);

  const processInbox = useCallback(async () => {
    if (!ensureReady()) return;
    const s = stateRef.current;
    if (!s.inbox.hasRaw) {
      log('Import at least one page before processing the inbox.');
      return;
    }
    const confirmed = window.confirm(
      'Process raw inbox items into jobs? Future AI extraction may use paid batch API calls.',
    );
    if (!confirmed) {
      log('Inbox processing cancelled.');
      return;
    }
    overrideLater('processInbox', 'Queueing...');
    try {
      const result = await apiRef.current.postJson<{
        status?: string;
        itemCount?: number;
        shardCount?: number;
        jobIds?: string[];
        batchId?: string;
      }>('/api/inbox/process', { limit: 20, shardSize: 20 });
      if (result.status === 'empty') {
        overrideLater('processInbox', 'Nothing to Process');
        dispatch({ type: 'set-inbox', inbox: { hasRaw: false, rawCount: 0 } });
        log('No raw inbox items to process.');
        return;
      }
      if (result.status === 'completed') {
        overrideLater('processInbox', 'Processed');
        dispatch({ type: 'set-inbox', inbox: { hasRaw: false, rawCount: 0 } });
        log(`Inbox processed: ${result.itemCount ?? 0} item(s), ${result.jobIds?.length ?? 0} job(s) created.`);
        await refreshQueues();
        await refreshInboxStatus();
        return;
      }
      overrideLater('processInbox', 'Queued');
      dispatch({ type: 'set-inbox', inbox: { hasRaw: false, rawCount: 0 } });
      log(`Inbox processing queued: ${result.itemCount ?? 0} item(s), ${result.shardCount ?? 0} shard(s).`);
      await refreshInboxStatus();
      if (result.batchId) startActiveRun(result.batchId, {
        buttonId: 'processInbox',
        stepProgress: '2/3',
        stepKicker: 'Step 2 of 3',
        completeLabel: 'Processed',
        failedLabel: 'Process Failed',
        resetLabel: 'Process Inbox',
      });
    } catch (err) {
      overrideLater('processInbox', 'Queue Failed');
      dispatch({
        type: 'set-connection',
        connection: { status: 'disconnected', detail: errorMessage(err) },
      });
    }
  }, [ensureReady, overrideLater, dispatch, log, refreshQueues, refreshInboxStatus]);

  const tailorInstantly = useCallback(async () => {
    if (!ensureReady()) return;
    const s = stateRef.current;
    if (!s.currentJobId) {
      log('This page is not a Ready job yet. Import it, then Process Inbox.');
      return;
    }
    if (!s.promptOpen.tailor) {
      dispatch({ type: 'open-prompt', which: 'tailor' });
      return;
    }
    const userPrompt = s.promptText.tailor.trim();
    overrideLater('tailorInstant', 'Sending...');
    try {
      const result = await apiRef.current.postJson<{ runId?: string }>('/api/tailor/quick', {
        jobId: s.currentJobId,
        userPrompt,
        artifactTargets: ['resume', 'cover_letter'],
      });
      dispatch({ type: 'close-prompt', which: 'tailor' });
      overrideLater('tailorInstant', 'Tailoring...');
      log(`Instant tailor started: ${result.runId ?? 'run pending'}`);
      if (result.runId) startActiveRun(result.runId, {
        buttonId: 'tailorInstant',
        stepProgress: '3/3',
        stepKicker: 'Step 3 of 3',
        completeLabel: 'Tailored',
        failedLabel: 'Tailor Failed',
        resetLabel: 'Tailor this job instantly',
      });
    } catch (err) {
      dispatch({ type: 'close-prompt', which: 'tailor' });
      overrideLater('tailorInstant', 'Tailor TODO');
      log(`Instant tailor unavailable: ${errorMessage(err)}`);
    }
  }, [ensureReady, dispatch, overrideLater, log]);

  const batchTailor = useCallback(async () => {
    if (!ensureReady()) return;
    const s = stateRef.current;
    const jobIds = s.queues.ready.map((item) => item.jobId ?? item.id).filter(Boolean);
    if (jobIds.length === 0) {
      log('No Ready jobs yet. Process Inbox first, then try Batch Tailor.');
      return;
    }
    const confirmed = window.confirm(
      `Start batch tailoring for ${jobIds.length} Ready job(s)? This may use paid AI batch API calls.`,
    );
    if (!confirmed) {
      log('Batch tailor cancelled.');
      return;
    }
    overrideLater('batchTailor', 'Queueing...');
    try {
      const result = await apiRef.current.postJson<{ runId?: string }>('/api/tailor/batch', { jobIds });
      overrideLater('batchTailor', 'Batch Tailoring...');
      log(`Batch tailor started: ${result.runId ?? 'run pending'}`);
      if (result.runId) startActiveRun(result.runId, {
        buttonId: 'batchTailor',
        stepProgress: '3/3',
        stepKicker: 'Step 3 of 3',
        completeLabel: 'Batch Ready',
        failedLabel: 'Batch Failed',
        resetLabel: 'Batch Tailor',
      });
    } catch (err) {
      overrideLater('batchTailor', 'Batch Failed');
      log(`Batch tailor failed to start: ${errorMessage(err)}`);
    }
  }, [ensureReady, overrideLater, log]);

  const openPreview = useCallback(async (kind: ArtifactKind) => {
    if (!ensureReady()) return;
    const s = stateRef.current;
    const artifact = kind === 'resume' ? s.artifacts.resume : s.artifacts.coverLetter;
    if (artifact.status !== 'ready') {
      log(kind === 'resume' ? 'Resume is not ready yet.' : 'Cover letter is not ready yet.');
      return;
    }
    const jobId = s.currentJobId;
    const path = kind === 'resume' ? 'resume' : 'cover-letter';
    const url = artifact.url ?? `${apiRef.current.base()}/api/jobs/${encodeURIComponent(jobId ?? '')}/artifacts/${path}`;
    if (hasChromeApi()) {
      await getChromeApi()!.tabs.create({ url });
    } else {
      window.open(url, '_blank', 'noopener');
    }
    log(kind === 'resume' ? 'Opened resume preview.' : 'Opened cover letter preview.');
    dispatch({ type: 'set-view', view: 'artifact-edit', artifactKind: kind });
  }, [ensureReady, dispatch, log]);

  const regenerateArtifact = useCallback(async () => {
    if (!ensureReady()) return;
    const s = stateRef.current;
    const kind = s.activeArtifactKind;
    if (kind !== 'resume' && kind !== 'cover-letter') {
      log('Open a resume or cover letter before regenerating.');
      return;
    }
    const userPrompt = s.promptText.artifactEdit.trim();
    if (!userPrompt) {
      log('Add edit instructions before regenerating.');
      return;
    }
    const label = kind === 'resume' ? 'Resume' : 'Cover Letter';
    overrideLater('regenerate', 'Sending...');
    try {
      const result = await apiRef.current.postJson<{ runId?: string }>('/api/artifacts/regenerate', {
        jobId: s.currentJobId,
        artifactType: kind === 'resume' ? 'resume' : 'cover_letter',
        existingArtifactText: '',
        userPrompt,
      });
      overrideLater('regenerate', 'Regenerating...');
      log(`${label} regeneration started: ${result.runId ?? 'run pending'}`);
      if (result.runId) startActiveRun(result.runId, {
        buttonId: 'regenerate',
        stepProgress: '3/3',
        stepKicker: 'Step 3 of 3',
        completeLabel: `${label} Ready`,
        failedLabel: 'Regenerate Failed',
        resetLabel: `Regenerate ${label}`,
      });
    } catch (err) {
      overrideLater('regenerate', 'Regenerate TODO');
      log(`${label} regeneration unavailable: ${errorMessage(err)}`);
    }
  }, [ensureReady, overrideLater, log]);

  const refreshActiveRun = useCallback(async () => {
    const s = stateRef.current;
    if (!s.activeRunId) {
      log('No active AI run to check yet.');
      return;
    }
    // Trigger one extra status read; the polling loop handles state transitions.
    try {
      await apiRef.current.fetchWithTimeout(`/api/runs/${encodeURIComponent(s.activeRunId)}`);
    } catch (err) {
      log(`Run status check failed: ${errorMessage(err)}`);
    }
  }, [log]);

  const closeArtifactEdit = useCallback(() => {
    dispatch({ type: 'set-view', view: 'main' });
  }, [dispatch]);

  const setPromptText = useCallback((which: 'tailor' | 'fill' | 'artifactEdit', text: string) => {
    dispatch({ type: 'set-prompt-text', which, text });
  }, [dispatch]);

  const startActiveRun = useCallback((runId: string, ui: ActiveRunUi) => {
    dispatch({ type: 'set-active-run', runId, ui });
  }, [dispatch]);

  // ---- effects ---------------------------------------------------------

  // When the active Chrome tab changes (or first loads), mirror the legacy
  // refreshCurrentTab cascade: re-check duplicate status and artifact
  // readiness for the new URL.
  const tabUrl = state.currentTab?.url ?? null;
  useEffect(() => {
    if (!tabUrl) return;
    void refreshCurrentPageStatus();
    void refreshArtifactStatus();
  }, [tabUrl, refreshCurrentPageStatus, refreshArtifactStatus]);

  // Heartbeat: every 5s while connected, ping + refresh runtime/inbox/queues.
  useDaemonHeartbeat({
    port,
    refresh: {
      runtime: refreshRuntimeStatus,
      queues: refreshQueues,
      inbox: refreshInboxStatus,
      artifacts: refreshArtifactStatus,
      pageStatus: refreshCurrentPageStatus,
      currentTab: tab.refresh,
    },
    ping: () => apiRef.current.ping(),
    log,
  });

  // Run polling: while activeRunId is set, poll every 5s for run status.
  useRunPolling({
    refresh: {
      runtime: refreshRuntimeStatus,
      queues: refreshQueues,
      inbox: refreshInboxStatus,
      artifacts: refreshArtifactStatus,
      pageStatus: refreshCurrentPageStatus,
      currentTab: tab.refresh,
    },
    fetchWithTimeout: (path, options) => apiRef.current.fetchWithTimeout(path, options),
    log,
  });

  return useMemo<CompanionActions>(() => ({
    port,
    reconnect,
    openWolfBrowser,
    openConfigPanel,
    closeConfigPanel,
    saveConfig,
    resetConfig,
    importCurrentPage,
    deleteCurrentImport,
    processCurrentPage,
    processInbox,
    tailorInstantly,
    batchTailor,
    openPreview,
    regenerateArtifact,
    refreshActiveRun,
    closeArtifactEdit,
    setPromptText,
    refresh: {
      runtime: refreshRuntimeStatus,
      queues: refreshQueues,
      inbox: refreshInboxStatus,
      artifacts: refreshArtifactStatus,
      pageStatus: refreshCurrentPageStatus,
      currentTab: tab.refresh,
    },
  }), [
    port, reconnect, openWolfBrowser, openConfigPanel, closeConfigPanel,
    saveConfig, resetConfig, importCurrentPage, deleteCurrentImport,
    processCurrentPage, processInbox, tailorInstantly, batchTailor,
    openPreview, regenerateArtifact, refreshActiveRun, closeArtifactEdit,
    setPromptText, refreshRuntimeStatus, refreshQueues, refreshInboxStatus,
    refreshArtifactStatus, refreshCurrentPageStatus, tab.refresh,
  ]);
}

// ---- helpers ----------------------------------------------------------

function isRuntimeReady(state: { connection: { status: string }; runtime: { browser: { status: string } } }) {
  return state.connection.status === 'connected' && state.runtime.browser.status === 'ready';
}

function runtimeBlockReason(state: { connection: { status: string }; runtime: { browser: { requiredAction: string } } }) {
  if (state.connection.status !== 'connected') return 'Connect to wolf serve first.';
  return state.runtime.browser.requiredAction || 'Start the browser from wolf serve, then reconnect.';
}

function normalizeQueues(raw: RawApiQueues): QueuesState {
  return {
    filling: normalizeQueueItems(raw.filling),
    ready: normalizeQueueItems(raw.ready),
    stuck: normalizeQueueItems(raw.stuck),
  };
}

function normalizeQueueItems(items: unknown): QueueItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw, index) => {
    const item = raw as {
      id?: string;
      jobId?: string | null;
      title?: string;
      company?: string;
      source?: string;
      url?: string | null;
      tabId?: number | null;
      windowId?: number | null;
    };
    return {
      id: item.jobId ?? item.id ?? `item-${index}`,
      jobId: item.jobId ?? item.id ?? null,
      title: item.title ?? 'Untitled job',
      company: item.company ?? item.source ?? 'Unknown company',
      url: item.url ?? null,
      tabId: item.tabId ?? null,
      windowId: item.windowId ?? null,
    };
  });
}

function matchCurrentJob(currentUrl: string | null, queues: QueuesState): string | null {
  const normalized = normalizeActionUrl(currentUrl);
  if (!normalized) return null;
  const match = queues.ready.find((item) => normalizeActionUrl(item.url) === normalized);
  return match?.jobId ?? null;
}
