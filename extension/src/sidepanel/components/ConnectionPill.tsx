import { useEffect, useState, type FormEvent } from 'react';
import { useCompanionState } from '../state/StateContext';
import { useCompanionActions } from '../hooks/useCompanionActions';
import { isValidPort } from '../utils';

// ConnectionPill renders a small pill summary in the top bar. Click to
// toggle the expanded form (rendered separately as <ConnectionPanel/>
// below the top-bar row, in the normal document flow). This keeps the
// form from floating absolutely on top of the WelcomeCard / Hero — it
// instead pushes the rest of the page down while open, so nothing is
// obscured even at narrow side-panel widths.

interface ConnectionPillProps {
  open: boolean;
  onToggle: () => void;
}

export function ConnectionPill({ open, onToggle }: ConnectionPillProps) {
  const { state } = useCompanionState();
  const actions = useCompanionActions();

  // Disambiguate the idle state. wolf does not auto-ping the daemon at
  // mount; an idle status with a generic "Waiting for local wolf serve"
  // detail is just "the user has not clicked Reconnect yet" — labeling
  // that as "Connecting" was actively misleading. Active reconnect
  // attempts set detail to "Pinging wolf serve...", so we look for that
  // marker to distinguish the two flavors of idle.
  const isPinging = state.connection.status === 'idle'
    && state.connection.detail.toLowerCase().includes('ping');
  const dotClass = `pill-dot pill-dot--${state.connection.status}${isPinging ? ' pill-dot--pinging' : ''}`;
  const summary = state.connection.status === 'connected'
    ? `:${actions.port}`
    : isPinging
      ? 'Connecting…'
      : labelFor(state.connection.status);

  return (
    <button
      type="button"
      className="pill-summary ghost-button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="connectionPanel"
      title={state.connection.detail}
    >
      <span className={dotClass} aria-hidden />
      {summary}
    </button>
  );
}

interface ConnectionPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectionPanel({ open, onClose }: ConnectionPanelProps) {
  const { state } = useCompanionState();
  const actions = useCompanionActions();
  const [portInput, setPortInput] = useState(actions.port);

  useEffect(() => {
    setPortInput(actions.port);
  }, [actions.port]);

  if (!open) return null;

  const portValid = portInput.length === 0 || isValidPort(portInput);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void actions.reconnect(portInput);
  };

  return (
    <form id="connectionPanel" className="connection-panel-row" onSubmit={onSubmit}>
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
        <button id="reconnectButton" type="submit" disabled={!portValid}>Reconnect</button>
      </div>
      <p id="connectionDetail" className="muted">{state.connection.detail}</p>
      <ApiKeyStatus />
      <p className="port-help">Start <strong>wolf serve</strong>, then copy the printed port here.</p>
      <div className="connection-panel-actions">
        <button
          id="openBrowserInlineButton"
          type="button"
          className="ghost-button"
          disabled={state.connection.status !== 'connected'}
          onClick={() => void actions.openWolfBrowser()}
        >
          {state.runtime.browser.status === 'ready' ? 'Show wolf browser' : 'Open wolf browser'}
        </button>
        <button type="button" className="ghost-button" onClick={onClose}>Close</button>
      </div>
    </form>
  );
}

function labelFor(status: string): string {
  switch (status) {
    case 'connected': return 'Connected';
    // The user has not started a connection attempt yet. "Not
    // connected" makes the click-to-set-up affordance discoverable
    // without falsely implying that wolf is actively trying.
    case 'idle': return 'Not connected';
    case 'disconnected': return 'Offline';
    default: return 'Setup';
  }
}

// API-key status row inside the expanded connection form. Three states:
//
//   1. Daemon hasn't reported env yet (still pinging or not connected) →
//      render nothing so we don't misinform.
//   2. Key present → green "API ready" + the env var name so the user
//      can confirm which slot is filled (dev vs stable env vars
//      diverge, this disambiguates).
//   3. Key missing → red warning + the exact env var name they need to
//      export. The Hero's missing-api-key phase already blocks paid
//      actions, but surfacing it here too means a connected user can
//      verify their setup without hunting.
function ApiKeyStatus() {
  const { state } = useCompanionState();
  const env = state.runtime.env?.anthropic;
  if (!env) return null;
  if (env.present) {
    return (
      <p className="api-status api-status--ok">
        <span aria-hidden>✓</span> API ready · <code>{env.envVarName}</code>
      </p>
    );
  }
  return (
    <p className="api-status api-status--missing">
      <span aria-hidden>⚠</span> API key missing · <code>{env.envVarName}</code>
    </p>
  );
}
