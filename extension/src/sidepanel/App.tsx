// S2a port: 1:1 JSX of the original buildless body content. The legacy
// main.js still owns all behavior — it mounts after this component renders
// and attaches event listeners by id. Hooks are extracted in S2b commits;
// state, controlled inputs, and handlers remain in main.js until then.
//
// React ownership boundary: this component never re-renders after mount
// (no state, no props), so main.js's document.querySelector + addEventListener
// calls operate on a stable DOM. Inputs use defaultValue so main.js can
// programmatically set .value without React fighting it back.

export function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">wolf companion</p>
          <h1>Apply Console</h1>
        </div>
        <div className="top-actions">
          <button id="configButton" className="ghost-button" type="button">Config</button>
          <span id="connectionBadge" className="status-badge status-badge--idle">Offline</span>
        </div>
      </header>

      <aside id="runtimeOverlay" className="runtime-overlay" hidden aria-live="polite">
        <div className="runtime-overlay-card">
          <p className="runtime-warning">⚠️ wolf browser is not ready</p>
          <p id="runtimeOverlayDetail">Start the browser from wolf serve, then reconnect.</p>
          <p id="runtimeOverlayStatus" className="muted">Current status: not_started</p>
          <button id="openBrowserButton" type="button">Open wolf browser</button>
        </div>
      </aside>

      <section className="panel connection-panel" aria-label="daemon connection">
        <label className="field-label" htmlFor="portInput">Port</label>
        <div className="port-row">
          <input id="portInput" inputMode="numeric" maxLength={5} pattern="[0-9]{4,5}" defaultValue="47823" />
          <button id="reconnectButton" type="button">Reconnect</button>
        </div>
        <p className="port-help">Start <strong>wolf serve</strong>, then copy the printed port here.</p>
        <p id="connectionDetail" className="muted">Waiting for local wolf serve.</p>
        <button id="openBrowserInlineButton" className="ghost-button browser-open-button" type="button">Open wolf browser</button>
      </section>

      <section id="workflowPanel" className="panel workflow-panel" aria-label="workflow status">
        <div className="workflow-progress" aria-hidden="true">
          <span id="workflowProgressNumber">0/3</span>
        </div>
        <div className="workflow-copy">
          <p id="workflowStageKicker" className="eyebrow">Setup</p>
          <h2 id="workflowStageTitle">Connect wolf</h2>
          <p id="actionHint" className="workflow-hint">Connect to wolf serve first.</p>
          <p className="workflow-steps">Steps: 1 Import, 2 Process, 3 Tailor. TODO: Fill and Reach out.</p>
        </div>
        <button id="refreshRunStatusButton" className="ghost-button refresh-chip" type="button">Check run</button>
      </section>

      <section id="currentPanel" className="panel current-panel" aria-label="current page actions">
        <div className="section-title">
          <h2>Current Page</h2>
          <span id="currentTabLabel" className="muted">No tab bound</span>
        </div>
        <p id="duplicateNotice" className="page-notice" hidden></p>
        <div className="action-grid">
          <div className="action-step">
            <div className="action-step__header">
              <span>1. Import</span>
              <small>Save the current page into wolf inbox.</small>
            </div>
            <div className="action-row action-row--with-delete">
              <button id="importCurrentPageButton" type="button">Import Page</button>
              <button id="deleteImportButton" className="square-button danger-square" type="button" title="Delete this import" hidden>×</button>
            </div>
          </div>
          <div className="action-step">
            <div className="action-step__header">
              <span>2. Process</span>
              <small>Turn imported pages into Ready jobs.</small>
            </div>
            <div className="action-row action-row--two-plus-delete">
              <button id="processCurrentPageButton" type="button">Process this page</button>
              <button id="processInboxButton" type="button">Batch Process</button>
              <button id="deleteProcessButton" className="square-button danger-square" type="button" title="Clear processed job" disabled>×</button>
            </div>
          </div>
          <div className="action-step">
            <div className="action-step__header">
              <span>3. Tailor</span>
              <small>Create resume and cover-letter artifacts.</small>
            </div>
            <div className="action-row action-row--two-plus-delete">
              <button id="tailorInstantButton" type="button">Tailor this job instantly</button>
              <button id="batchTailorButton" type="button">Batch Tailor</button>
              <button id="deleteTailorButton" className="square-button danger-square" type="button" title="Clear tailor artifacts" disabled>×</button>
            </div>
          </div>
          <div className="action-step action-step--quiet">
            <div className="action-step__header">
              <span>Artifacts</span>
              <small>Open generated files when they are ready.</small>
            </div>
            <div className="action-row action-row--two">
              <button id="previewResumeButton" type="button">Resume</button>
              <button id="previewCoverLetterButton" type="button">Cover Letter</button>
            </div>
          </div>
          <div className="action-step action-step--quiet">
            <div className="action-step__header">
              <span>Next</span>
              <small>Planned after the import-process-tailor flow.</small>
            </div>
            <button id="autofillQuickButton" type="button" disabled>Autofill this page</button>
            <button id="outreachDraftButton" type="button" disabled>Generate outreach draft</button>
          </div>
        </div>
        <div id="tailorPromptBox" className="prompt-box" hidden>
          <label className="field-label" htmlFor="tailorPromptInput">Tailor instructions</label>
          <textarea id="tailorPromptInput" rows={4} placeholder="Optional: emphasize backend systems, keep education short, target internship tone..."></textarea>
          <p className="prompt-help">Optional one-shot instructions. Editing does not remember previous requests, so include all requirements and changes in this message.</p>
        </div>
        <div id="fillPromptBox" className="prompt-box" hidden>
          <label className="field-label" htmlFor="fillPromptInput">Autofill instructions</label>
          <textarea id="fillPromptInput" rows={4} placeholder="Optional: prefer San Francisco, use work authorization answer from profile..."></textarea>
          <p className="prompt-help">Optional page-specific instructions. wolf will fill the form but will not submit it.</p>
        </div>
      </section>

      <section id="artifactEditPanel" className="panel edit-panel" aria-label="artifact edit" hidden>
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Artifact Editor</p>
            <h2 id="artifactEditTitle">Edit Resume</h2>
          </div>
          <button id="backToCurrentButton" className="ghost-button" type="button">Back</button>
        </div>
        <p className="prompt-warning">One-shot edit only. This editor does not remember previous changes. Include the exact edits and requirements you want in this message.</p>
        <label className="field-label" htmlFor="artifactEditPromptInput">Edit instructions</label>
        <textarea id="artifactEditPromptInput" rows={7} placeholder="Example: make the project bullets more backend-heavy, remove coursework, and keep it one page."></textarea>
        <button id="regenerateArtifactButton" type="button">Regenerate Resume</button>
      </section>

      <section id="configPanel" className="panel config-panel" aria-label="wolf config" hidden>
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>wolf Config</h2>
          </div>
          <button id="closeConfigButton" className="ghost-button" type="button">Back</button>
        </div>
        <div className="form-section">
          <label className="field-label" htmlFor="configDefaultInput">Default profile</label>
          <input id="configDefaultInput" defaultValue="default" />
          <p className="form-help">Writes <code>default</code> in wolf.toml.</p>
        </div>
        <div className="form-section">
          <p className="field-label">Hunt</p>
          <label htmlFor="configHuntMinScoreInput">Minimum score</label>
          <input id="configHuntMinScoreInput" inputMode="decimal" defaultValue="0.5" />
          <label htmlFor="configHuntMaxResultsInput">Max results</label>
          <input id="configHuntMaxResultsInput" inputMode="numeric" defaultValue="50" />
        </div>
        <div className="form-section">
          <p className="field-label">Tailor</p>
          <label htmlFor="configTailorModelInput">Model</label>
          <input id="configTailorModelInput" defaultValue="anthropic/claude-sonnet-4-6" />
          <label htmlFor="configCoverLetterToneInput">Default cover letter tone</label>
          <input id="configCoverLetterToneInput" defaultValue="professional" />
        </div>
        <div className="form-section">
          <p className="field-label">Score</p>
          <label htmlFor="configScoreModelInput">Model</label>
          <input id="configScoreModelInput" defaultValue="anthropic/claude-sonnet-4-6" />
        </div>
        <div className="form-section">
          <p className="field-label">Reach</p>
          <label htmlFor="configReachModelInput">Model</label>
          <input id="configReachModelInput" defaultValue="anthropic/claude-sonnet-4-6" />
          <label htmlFor="configEmailToneInput">Default email tone</label>
          <input id="configEmailToneInput" defaultValue="professional" />
          <label htmlFor="configMaxEmailsPerDayInput">Max emails per day</label>
          <input id="configMaxEmailsPerDayInput" inputMode="numeric" defaultValue="10" />
        </div>
        <div className="form-section">
          <p className="field-label">Fill</p>
          <label htmlFor="configFillModelInput">Model</label>
          <input id="configFillModelInput" defaultValue="anthropic/claude-haiku-4-5-20251001" />
        </div>
        <div className="config-actions">
          <button id="saveConfigButton" type="button">Save Config</button>
          <button id="resetConfigButton" className="danger-button" type="button">Reset Config</button>
        </div>
      </section>

      <section className="queue queue--disabled" aria-label="application queue">
        <p className="queue-coming-soon">Application queue is not implemented yet. Coming soon.</p>
        <article className="queue-column" data-column="filling">
          <div className="column-head">
            <div>
              <p>Filling</p>
              <strong id="fillingCount">0</strong>
            </div>
            <button className="next-button" type="button" data-next-column="filling" disabled>Next</button>
          </div>
          <ol id="fillingList" className="job-list"></ol>
        </article>

        <article className="queue-column" data-column="ready">
          <div className="column-head">
            <div>
              <p>Ready</p>
              <strong id="readyCount">0</strong>
            </div>
            <button className="next-button" type="button" data-next-column="ready" disabled>Next</button>
          </div>
          <ol id="readyList" className="job-list"></ol>
        </article>

        <article className="queue-column" data-column="stuck">
          <div className="column-head">
            <div>
              <p>Stuck</p>
              <strong id="stuckCount">0</strong>
            </div>
            <button className="next-button" type="button" data-next-column="stuck" disabled>Next</button>
          </div>
          <ol id="stuckList" className="job-list"></ol>
        </article>
      </section>

      <footer className="activity">
        <p className="field-label">Activity</p>
        <ul id="activityLog"></ul>
      </footer>
    </main>
  );
}
