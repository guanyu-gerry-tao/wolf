import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { CompanionStateProvider, useCompanionState } from './state/StateContext';
import { useCompanionActions, type ConfigPayload } from './hooks/useCompanionActions';
import type { CompanionState } from './state/types';
import {
  AUTOFILL_BLOCKED_REASON,
  OUTREACH_BLOCKED_REASON,
  PROCESS_DELETE_BLOCKED_REASON,
  TAILOR_DELETE_BLOCKED_REASON,
  QUEUE_COMING_SOON_MESSAGE,
  INCOMPLETE_TOOLTIP,
  isValidPort,
} from './utils';

// Top-level App wraps the companion shell in the Context provider so any
// child component can read state via useCompanionState. The shell holds all
// hook composition + JSX; component decomposition is deferred to S3.
export function App() {
  return (
    <CompanionStateProvider>
      <AppShell />
    </CompanionStateProvider>
  );
}

function AppShell() {
  const { state } = useCompanionState();
  const actions = useCompanionActions();

  const ready = isRuntimeReady(state);
  const workflow = computeWorkflow(state);
  const blockReason = runtimeBlockReason(state);

  return (
    <main className="shell">
      <Topbar />
      <RuntimeOverlay actions={actions} />
      <ConnectionPanel actions={actions} />
      <WorkflowPanel state={state} actions={actions} ready={ready} workflow={workflow} blockReason={blockReason} />
      <CurrentPanel state={state} actions={actions} ready={ready} blockReason={blockReason} hidden={state.view !== 'main'} />
      <ArtifactEditPanel state={state} actions={actions} ready={ready} blockReason={blockReason} hidden={state.view !== 'artifact-edit'} />
      <ConfigPanel actions={actions} hidden={state.view !== 'config'} />
      <QueueDisplay state={state} />
      <ActivityFooter state={state} />
    </main>
  );
}

// ---- Topbar -----------------------------------------------------------

function Topbar() {
  const { state } = useCompanionState();
  const { openConfigPanel, closeConfigPanel } = useCompanionActions();
  const onClickConfig = state.view === 'config' ? closeConfigPanel : openConfigPanel;
  const badgeLabel = {
    connected: 'Online',
    disconnected: 'Offline',
    idle: 'Idle',
  }[state.connection.status];
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">wolf companion</p>
        <h1>Apply Console</h1>
      </div>
      <div className="top-actions">
        <button id="configButton" className="ghost-button" type="button" onClick={onClickConfig}>Config</button>
        <span id="connectionBadge" className={`status-badge status-badge--${state.connection.status}`}>{badgeLabel}</span>
      </div>
    </header>
  );
}

// ---- Runtime overlay --------------------------------------------------

function RuntimeOverlay({ actions }: { actions: ReturnType<typeof useCompanionActions> }) {
  const { state } = useCompanionState();
  const visible = state.connection.status === 'connected' && state.runtime.browser.status !== 'ready';
  const detail = state.runtime.browser.requiredAction || 'Start the browser from wolf serve, then reconnect.';
  return (
    <aside id="runtimeOverlay" className="runtime-overlay" hidden={!visible} aria-live="polite">
      <div className="runtime-overlay-card">
        <p className="runtime-warning">⚠️ wolf browser is not ready</p>
        <p id="runtimeOverlayDetail">{detail}</p>
        <p id="runtimeOverlayStatus" className="muted">Current status: {state.runtime.browser.status}</p>
        <button
          id="openBrowserButton"
          type="button"
          disabled={state.connection.status !== 'connected'}
          onClick={() => void actions.openWolfBrowser()}
        >
          {labelForButton('openBrowser', state, 'Open wolf browser')}
        </button>
      </div>
    </aside>
  );
}

// ---- Connection panel -------------------------------------------------

function ConnectionPanel({ actions }: { actions: ReturnType<typeof useCompanionActions> }) {
  const { state } = useCompanionState();
  const [portInput, setPortInput] = useState<string>(actions.port);

  // Sync the input when the persisted port loads from chrome.storage.
  useEffect(() => {
    setPortInput(actions.port);
  }, [actions.port]);

  const inlineButtonLabel = labelForButton(
    'openBrowser',
    state,
    state.runtime.browser.status === 'ready' ? 'Show wolf browser' : 'Open wolf browser',
  );
  const inlineDisabled = state.connection.status !== 'connected';
  const portValid = isValidPort(portInput);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void actions.reconnect(portInput);
  };

  return (
    <section className="panel connection-panel" aria-label="daemon connection">
      <form onSubmit={onSubmit}>
        <label className="field-label" htmlFor="portInput">Port</label>
        <div className="port-row">
          <input
            id="portInput"
            inputMode="numeric"
            maxLength={5}
            pattern="[0-9]{4,5}"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
          />
          <button id="reconnectButton" type="submit" disabled={!portValid && portInput.length > 0}>Reconnect</button>
        </div>
        <p className="port-help">Start <strong>wolf serve</strong>, then copy the printed port here.</p>
        <p id="connectionDetail" className="muted">{state.connection.detail}</p>
        <button
          id="openBrowserInlineButton"
          className="ghost-button browser-open-button"
          type="button"
          disabled={inlineDisabled}
          title={inlineDisabled ? 'Connect to wolf serve first.' : ''}
          onClick={() => void actions.openWolfBrowser()}
        >
          {inlineButtonLabel}
        </button>
      </form>
    </section>
  );
}

// ---- Workflow panel ---------------------------------------------------

interface WorkflowPanelProps {
  state: CompanionState;
  actions: ReturnType<typeof useCompanionActions>;
  ready: boolean;
  workflow: WorkflowStatus;
  blockReason: string;
}

function WorkflowPanel({ state, actions, ready, workflow, blockReason }: WorkflowPanelProps) {
  const checkRunDisabled = !ready || !state.activeRunId;
  const checkRunTitle = !ready ? blockReason : (!state.activeRunId ? 'No active AI run to check yet.' : 'Check the latest local status for the active AI run.');
  const checkRunLabel = state.activeRunId ? 'Check run' : 'No run';
  return (
    <section id="workflowPanel" className="panel workflow-panel" aria-label="workflow status">
      <div className="workflow-progress" aria-hidden="true">
        <span id="workflowProgressNumber">{workflow.progress}</span>
      </div>
      <div className="workflow-copy">
        <p id="workflowStageKicker" className="eyebrow">{workflow.kicker}</p>
        <h2 id="workflowStageTitle">{workflow.title}</h2>
        <p id="actionHint" className="workflow-hint">{workflow.hint}</p>
        <p className="workflow-steps">Steps: 1 Import, 2 Process, 3 Tailor. TODO: Fill and Reach out.</p>
      </div>
      <button
        id="refreshRunStatusButton"
        className="ghost-button refresh-chip"
        type="button"
        disabled={checkRunDisabled}
        title={checkRunTitle}
        onClick={() => void actions.refreshActiveRun()}
      >
        {checkRunLabel}
      </button>
    </section>
  );
}

// ---- Current panel ----------------------------------------------------

interface CurrentPanelProps {
  state: CompanionState;
  actions: ReturnType<typeof useCompanionActions>;
  ready: boolean;
  blockReason: string;
  hidden?: boolean;
}

function CurrentPanel({ state, actions, ready, blockReason, hidden }: CurrentPanelProps) {
  const tabLabel = state.currentTab
    ? `${state.currentTab.title || 'Current tab'}${state.currentTab.url ? ` - ${state.currentTab.url}` : ''}`
    : (typeof globalThis.chrome?.runtime?.id === 'string' ? 'Reading...' : 'Demo mode');

  const importLabel = computeImportLabel(state, ready);
  const importDisabled = !ready || Boolean(state.buttonOverrides.import?.disabled);
  const importVariant = computeImportVariant(state, ready);

  const isDuplicate = state.currentPageStatus.kind === 'duplicate';
  const isAggregator = state.currentPageStatus.kind === 'aggregator';

  // Delete-import visibility matches legacy renderImportDeleteState.
  const canDelete = ready &&
    state.currentPageStatus.kind === 'duplicate' &&
    Boolean(state.currentPageStatus.detail.inboxId);

  // Process this page gating matches legacy renderProcessCurrentPageState.
  const processCurrentDisabled = !ready ||
    state.currentPageStatus.kind !== 'duplicate' ||
    state.currentPageStatus.detail.status !== 'raw';

  // Process inbox.
  const processInboxLabel = labelForButton('processInbox', state, `Batch Process (${state.inbox.rawCount})`);
  const processInboxDisabled = !ready || !state.inbox.hasRaw || Boolean(state.buttonOverrides.processInbox?.disabled);

  // Tailor instant.
  const tailorInstantBaseLabel = state.promptOpen.tailor
    ? (state.promptText.tailor.trim() ? 'Send' : 'Tailor this job instantly')
    : 'Tailor this job instantly';
  const tailorInstantLabel = labelForButton('tailorInstant', state, tailorInstantBaseLabel);
  const tailorInstantDisabled = !ready || !state.currentJobId || Boolean(state.buttonOverrides.tailorInstant?.disabled);

  // Batch tailor.
  const batchTailorLabel = labelForButton('batchTailor', state, `Batch Tailor (${state.tailor.untailoredJobCount})`);
  const batchTailorDisabled = !ready || state.tailor.untailoredJobCount === 0 || Boolean(state.buttonOverrides.batchTailor?.disabled);

  // Artifacts.
  const resumeReady = state.artifacts.resume.status === 'ready';
  const coverReady = state.artifacts.coverLetter.status === 'ready';

  return (
    <section id="currentPanel" className="panel current-panel" aria-label="current page actions" hidden={hidden}>
      <div className="section-title">
        <h2>Current Page</h2>
        <span id="currentTabLabel" className="muted">{tabLabel}</span>
      </div>

      {(isDuplicate || isAggregator) && <DuplicateNotice state={state} />}

      <div className="action-grid">
        <div className="action-step">
          <div className="action-step__header">
            <span>1. Import</span>
            <small>Save the current page into wolf inbox.</small>
          </div>
          <div className="action-row action-row--with-delete">
            <button
              id="importCurrentPageButton"
              type="button"
              className={importVariant ? `button-${importVariant}` : ''}
              disabled={importDisabled}
              title={!ready ? blockReason : ''}
              onClick={() => void actions.importCurrentPage()}
            >
              {importLabel}
            </button>
            <button
              id="deleteImportButton"
              className="square-button danger-square"
              type="button"
              title={canDelete ? 'Delete this import from wolf inbox.' : 'No import to delete.'}
              disabled={!canDelete}
              hidden={!canDelete}
              onClick={() => void actions.deleteCurrentImport()}
            >×</button>
          </div>
        </div>

        <div className="action-step">
          <div className="action-step__header">
            <span>2. Process</span>
            <small>Turn imported pages into Ready jobs.</small>
          </div>
          <div className="action-row action-row--two-plus-delete">
            <button
              id="processCurrentPageButton"
              type="button"
              disabled={processCurrentDisabled}
              title={!ready ? blockReason : (processCurrentDisabled ? 'Import this page first, or use Batch Process for all raw inbox items.' : 'Process only this imported page into a Ready job.')}
              onClick={() => void actions.processCurrentPage()}
            >
              {labelForButton('processCurrentPage', state, 'Process this page')}
            </button>
            <button
              id="processInboxButton"
              type="button"
              disabled={processInboxDisabled}
              title={!ready ? blockReason : (state.inbox.hasRaw ? `Process ${state.inbox.rawCount} imported raw page(s) into Ready jobs.` : 'Import at least one page before batch processing the inbox.')}
              onClick={() => void actions.processInbox()}
            >
              {processInboxLabel}
            </button>
            <button
              id="deleteProcessButton"
              className="square-button danger-square"
              type="button"
              title={PROCESS_DELETE_BLOCKED_REASON}
              disabled
            >×</button>
          </div>
        </div>

        <div className="action-step">
          <div className="action-step__header">
            <span>3. Tailor</span>
            <small>Create resume and cover-letter artifacts.</small>
          </div>
          <div className="action-row action-row--two-plus-delete">
            <button
              id="tailorInstantButton"
              type="button"
              disabled={tailorInstantDisabled}
              title={!ready ? blockReason : (!state.currentJobId ? 'This page is not a Ready job yet. Import it, then Process Inbox.' : 'Tailor resume and cover letter for this Ready job.')}
              onClick={() => void actions.tailorInstantly()}
            >
              {tailorInstantLabel}
            </button>
            <button
              id="batchTailorButton"
              type="button"
              disabled={batchTailorDisabled}
              title={!ready ? blockReason : (state.tailor.untailoredJobCount === 0 ? 'No untailored jobs yet. Process Inbox first, or all jobs are already tailored.' : `Batch tailor ${state.tailor.untailoredJobCount} untailored job(s).`)}
              onClick={() => void actions.batchTailor()}
            >
              {batchTailorLabel}
            </button>
            <button
              id="deleteTailorButton"
              className="square-button danger-square"
              type="button"
              title={TAILOR_DELETE_BLOCKED_REASON}
              disabled
            >×</button>
          </div>
        </div>

        <div className="action-step action-step--quiet">
          <div className="action-step__header">
            <span>Artifacts</span>
            <small>Open generated files when they are ready.</small>
          </div>
          <div className="action-row action-row--two">
            <button
              id="previewResumeButton"
              type="button"
              className={resumeReady ? 'button-success' : ''}
              disabled={!resumeReady || !ready}
              title={!ready ? blockReason : (resumeReady ? '' : 'Resume is not ready yet.')}
              onClick={() => void actions.openPreview('resume')}
            >
              {resumeReady ? 'Resume' : 'Resume Not Ready'}
            </button>
            <button
              id="previewCoverLetterButton"
              type="button"
              className={coverReady ? 'button-success' : ''}
              disabled={!coverReady || !ready}
              title={!ready ? blockReason : (coverReady ? '' : 'Cover Letter is not ready yet.')}
              onClick={() => void actions.openPreview('cover-letter')}
            >
              {coverReady ? 'Cover Letter' : 'Cover Letter Not Ready'}
            </button>
          </div>
        </div>

        <div className="action-step action-step--quiet">
          <div className="action-step__header">
            <span>Next</span>
            <small>Planned after the import-process-tailor flow.</small>
          </div>
          <button
            id="autofillQuickButton"
            type="button"
            disabled
            title={`${INCOMPLETE_TOOLTIP}: ${AUTOFILL_BLOCKED_REASON}`}
          >
            Autofill this page <IncompleteBadge reason={AUTOFILL_BLOCKED_REASON} />
          </button>
          <button
            id="outreachDraftButton"
            type="button"
            disabled
            title={`${INCOMPLETE_TOOLTIP}: ${OUTREACH_BLOCKED_REASON}`}
          >
            Generate outreach draft <IncompleteBadge reason={OUTREACH_BLOCKED_REASON} />
          </button>
        </div>
      </div>

      {state.promptOpen.tailor && (
        <div id="tailorPromptBox" className="prompt-box">
          <label className="field-label" htmlFor="tailorPromptInput">Tailor instructions</label>
          <textarea
            id="tailorPromptInput"
            rows={4}
            placeholder="Optional: emphasize backend systems, keep education short, target internship tone..."
            value={state.promptText.tailor}
            onChange={(e) => actions.setPromptText('tailor', e.target.value)}
          />
          <p className="prompt-help">Optional one-shot instructions. Editing does not remember previous requests, so include all requirements and changes in this message.</p>
        </div>
      )}
      {state.promptOpen.fill && (
        <div id="fillPromptBox" className="prompt-box">
          <label className="field-label" htmlFor="fillPromptInput">Autofill instructions</label>
          <textarea
            id="fillPromptInput"
            rows={4}
            placeholder="Optional: prefer San Francisco, use work authorization answer from profile..."
            value={state.promptText.fill}
            onChange={(e) => actions.setPromptText('fill', e.target.value)}
          />
          <p className="prompt-help">Optional page-specific instructions. wolf will fill the form but will not submit it.</p>
        </div>
      )}
    </section>
  );
}

function DuplicateNotice({ state }: { state: CompanionState }) {
  if (state.currentPageStatus.kind === 'duplicate') {
    const detail = state.currentPageStatus.detail;
    const url = detail.url || state.currentTab?.url;
    return (
      <p id="duplicateNotice" className="page-notice page-notice--success">
        Already imported. Please check{' '}
        {url ? (
          <a href={url} title={url} target="_blank" rel="noopener noreferrer">{detail.title}</a>
        ) : (
          detail.title
        )}
      </p>
    );
  }
  if (state.currentPageStatus.kind === 'aggregator') {
    return (
      <p id="duplicateNotice" className="page-notice page-notice--warning">
        {state.currentPageStatus.detail}
      </p>
    );
  }
  return null;
}

function IncompleteBadge({ reason }: { reason: string }) {
  return (
    <span
      className="incomplete-badge"
      title={`${INCOMPLETE_TOOLTIP}: ${reason}`}
      aria-label={`${INCOMPLETE_TOOLTIP}: ${reason}`}
    >⚠️</span>
  );
}

// ---- Artifact edit panel ----------------------------------------------

interface ArtifactEditPanelProps {
  state: CompanionState;
  actions: ReturnType<typeof useCompanionActions>;
  ready: boolean;
  blockReason: string;
  hidden?: boolean;
}

function ArtifactEditPanel({ state, actions, ready, blockReason, hidden }: ArtifactEditPanelProps) {
  const kindLabel = state.activeArtifactKind === 'resume' ? 'Resume' : 'Cover Letter';
  const buttonLabel = labelForButton('regenerate', state, `Regenerate ${kindLabel}`);
  return (
    <section id="artifactEditPanel" className="panel edit-panel" aria-label="artifact edit" hidden={hidden}>
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">Artifact Editor</p>
          <h2 id="artifactEditTitle">Edit {kindLabel}</h2>
        </div>
        <button
          id="backToCurrentButton"
          className="ghost-button"
          type="button"
          onClick={actions.closeArtifactEdit}
        >Back</button>
      </div>
      <p className="prompt-warning">One-shot edit only. This editor does not remember previous changes. Include the exact edits and requirements you want in this message.</p>
      <label className="field-label" htmlFor="artifactEditPromptInput">Edit instructions</label>
      <textarea
        id="artifactEditPromptInput"
        rows={7}
        placeholder="Example: make the project bullets more backend-heavy, remove coursework, and keep it one page."
        value={state.promptText.artifactEdit}
        onChange={(e) => actions.setPromptText('artifactEdit', e.target.value)}
      />
      <button
        id="regenerateArtifactButton"
        type="button"
        disabled={!ready}
        title={!ready ? blockReason : ''}
        onClick={() => void actions.regenerateArtifact()}
      >{buttonLabel}</button>
    </section>
  );
}

// ---- Config panel -----------------------------------------------------

const DEFAULT_CONFIG: ConfigPayload = {
  default: 'default',
  hunt: { minScore: 0.5, maxResults: 50 },
  tailor: { model: 'anthropic/claude-sonnet-4-6', defaultCoverLetterTone: 'professional' },
  score: { model: 'anthropic/claude-sonnet-4-6' },
  reach: { model: 'anthropic/claude-sonnet-4-6', defaultEmailTone: 'professional', maxEmailsPerDay: 10 },
  fill: { model: 'anthropic/claude-haiku-4-5-20251001' },
};

function ConfigPanel({ actions, hidden }: { actions: ReturnType<typeof useCompanionActions>; hidden?: boolean }) {
  const [values, setValues] = useState<ConfigPayload>(DEFAULT_CONFIG);
  const { state, log } = useCompanionState();

  // Hydrate from the daemon when it loads or when reset returns a fresh config.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ConfigPayload>).detail;
      if (detail) setValues(detail);
    };
    window.addEventListener('wolf-config-loaded', handler as EventListener);
    return () => window.removeEventListener('wolf-config-loaded', handler as EventListener);
  }, []);

  const onSave = () => {
    try {
      // Validation matches legacy readConfigForm: minScore in [0,1], counts >= 1.
      const minScore = Number(values.hunt.minScore);
      const maxResults = Number(values.hunt.maxResults);
      const maxEmails = Number(values.reach.maxEmailsPerDay);
      if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) {
        throw new Error('Hunt minimum score must be a number from 0 to 1.');
      }
      if (!Number.isInteger(maxResults) || maxResults < 1) {
        throw new Error('Hunt max results must be a positive integer.');
      }
      if (!Number.isInteger(maxEmails) || maxEmails < 1) {
        throw new Error('Reach max emails per day must be a positive integer.');
      }
      void actions.saveConfig(values);
    } catch (err) {
      log(err instanceof Error ? err.message : String(err));
    }
  };

  const saveLabel = labelForButton('saveConfig', state, 'Save Config');
  const resetLabel = labelForButton('resetConfig', state, 'Reset Config');

  return (
    <section id="configPanel" className="panel config-panel" aria-label="wolf config" hidden={hidden}>
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>wolf Config</h2>
        </div>
        <button
          id="closeConfigButton"
          className="ghost-button"
          type="button"
          onClick={actions.closeConfigPanel}
        >Back</button>
      </div>
      <div className="form-section">
        <label className="field-label" htmlFor="configDefaultInput">Default profile</label>
        <input id="configDefaultInput" value={values.default} onChange={(e) => setValues((v) => ({ ...v, default: e.target.value }))} />
        <p className="form-help">Writes <code>default</code> in wolf.toml.</p>
      </div>
      <div className="form-section">
        <p className="field-label">Hunt</p>
        <label htmlFor="configHuntMinScoreInput">Minimum score</label>
        <input id="configHuntMinScoreInput" inputMode="decimal" value={String(values.hunt.minScore)} onChange={(e) => setValues((v) => ({ ...v, hunt: { ...v.hunt, minScore: Number(e.target.value) } }))} />
        <label htmlFor="configHuntMaxResultsInput">Max results</label>
        <input id="configHuntMaxResultsInput" inputMode="numeric" value={String(values.hunt.maxResults)} onChange={(e) => setValues((v) => ({ ...v, hunt: { ...v.hunt, maxResults: Number(e.target.value) } }))} />
      </div>
      <div className="form-section">
        <p className="field-label">Tailor</p>
        <label htmlFor="configTailorModelInput">Model</label>
        <input id="configTailorModelInput" value={values.tailor.model} onChange={(e) => setValues((v) => ({ ...v, tailor: { ...v.tailor, model: e.target.value } }))} />
        <label htmlFor="configCoverLetterToneInput">Default cover letter tone</label>
        <input id="configCoverLetterToneInput" value={values.tailor.defaultCoverLetterTone} onChange={(e) => setValues((v) => ({ ...v, tailor: { ...v.tailor, defaultCoverLetterTone: e.target.value } }))} />
      </div>
      <div className="form-section">
        <p className="field-label">Score</p>
        <label htmlFor="configScoreModelInput">Model</label>
        <input id="configScoreModelInput" value={values.score.model} onChange={(e) => setValues((v) => ({ ...v, score: { model: e.target.value } }))} />
      </div>
      <div className="form-section">
        <p className="field-label">Reach</p>
        <label htmlFor="configReachModelInput">Model</label>
        <input id="configReachModelInput" value={values.reach.model} onChange={(e) => setValues((v) => ({ ...v, reach: { ...v.reach, model: e.target.value } }))} />
        <label htmlFor="configEmailToneInput">Default email tone</label>
        <input id="configEmailToneInput" value={values.reach.defaultEmailTone} onChange={(e) => setValues((v) => ({ ...v, reach: { ...v.reach, defaultEmailTone: e.target.value } }))} />
        <label htmlFor="configMaxEmailsPerDayInput">Max emails per day</label>
        <input id="configMaxEmailsPerDayInput" inputMode="numeric" value={String(values.reach.maxEmailsPerDay)} onChange={(e) => setValues((v) => ({ ...v, reach: { ...v.reach, maxEmailsPerDay: Number(e.target.value) } }))} />
      </div>
      <div className="form-section">
        <p className="field-label">Fill</p>
        <label htmlFor="configFillModelInput">Model</label>
        <input id="configFillModelInput" value={values.fill.model} onChange={(e) => setValues((v) => ({ ...v, fill: { model: e.target.value } }))} />
      </div>
      <div className="config-actions">
        <button id="saveConfigButton" type="button" onClick={onSave}>{saveLabel}</button>
        <button id="resetConfigButton" className="danger-button" type="button" onClick={() => void actions.resetConfig()}>{resetLabel}</button>
      </div>
    </section>
  );
}

// ---- Queue + activity ------------------------------------------------

function QueueDisplay({ state }: { state: CompanionState }) {
  return (
    <section className="queue queue--disabled" aria-label="application queue">
      <p className="queue-coming-soon">{QUEUE_COMING_SOON_MESSAGE}</p>
      {(['filling', 'ready', 'stuck'] as const).map((column) => (
        <article className="queue-column" data-column={column} key={column}>
          <div className="column-head">
            <div>
              <p>{column.charAt(0).toUpperCase() + column.slice(1)}</p>
              <strong id={`${column}Count`}>—</strong>
            </div>
            <button className="next-button" type="button" data-next-column={column} disabled title={QUEUE_COMING_SOON_MESSAGE}>Next</button>
          </div>
          <ol id={`${column}List`} className="job-list">
            <li className="empty-state">Queue not implemented yet.</li>
          </ol>
        </article>
      ))}
      {/* Counts hidden but kept in DOM for legacy harness selectors */}
      <span hidden>{state.queues.filling.length}</span>
    </section>
  );
}

function ActivityFooter({ state }: { state: CompanionState }) {
  return (
    <footer className="activity">
      <p className="field-label">Activity</p>
      <ul id="activityLog">
        {state.activity.map((entry) => (
          <li key={entry.id}>{entry.timestamp}  {entry.message}</li>
        ))}
      </ul>
    </footer>
  );
}

// ---- Derived helpers ------------------------------------------------

interface WorkflowStatus {
  progress: string;
  kicker: string;
  title: string;
  hint: string;
}

function isRuntimeReady(state: CompanionState): boolean {
  return state.connection.status === 'connected' && state.runtime.browser.status === 'ready';
}

function runtimeBlockReason(state: CompanionState): string {
  if (state.connection.status !== 'connected') return 'Connect to wolf serve first.';
  return state.runtime.browser.requiredAction || 'Start the browser from wolf serve, then reconnect.';
}

function computeWorkflow(state: CompanionState): WorkflowStatus {
  if (!isRuntimeReady(state)) {
    return {
      progress: '0/3',
      kicker: 'Setup',
      title: 'Connect wolf',
      hint: runtimeBlockReason(state),
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

function labelForButton(buttonId: string, state: CompanionState, defaultLabel: string): string {
  return state.buttonOverrides[buttonId]?.label ?? defaultLabel;
}

function computeImportLabel(state: CompanionState, ready: boolean): string {
  const override = state.buttonOverrides.import?.label;
  if (override) return override;
  if (!ready) return 'Import Page';
  if (state.currentPageStatus.kind === 'duplicate') return 'Already Imported';
  return 'Import Page';
}

function computeImportVariant(state: CompanionState, ready: boolean): 'success' | 'warning' | null {
  if (!ready) return null;
  if (state.currentPageStatus.kind === 'duplicate') return 'success';
  if (state.currentPageStatus.kind === 'aggregator') return 'warning';
  return null;
}

// Suppress an unused export warning when memoization helpers are not in use.
void useMemo;
