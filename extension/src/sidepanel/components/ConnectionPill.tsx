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

  const dotClass = `pill-dot pill-dot--${state.connection.status}`;
  const summary = state.connection.status === 'connected' ? `:${actions.port}` : labelFor(state.connection.status);

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
    case 'idle': return 'Connecting';
    case 'disconnected': return 'Offline';
    default: return 'Setup';
  }
}
