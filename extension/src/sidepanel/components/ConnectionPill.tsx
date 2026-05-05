import { useEffect, useState, type FormEvent } from 'react';
import { useCompanionState } from '../state/StateContext';
import { useCompanionActions } from '../hooks/useCompanionActions';
import { isValidPort } from '../utils';

// Compact connection chip that lives in the top bar. Click to expand the
// port + Reconnect controls in a small popover. Replaces the legacy
// always-on PORT panel that occupied prime real estate.

export function ConnectionPill() {
  const { state } = useCompanionState();
  const actions = useCompanionActions();
  const [open, setOpen] = useState(false);
  const [portInput, setPortInput] = useState(actions.port);

  // Sync the input value when the persisted port loads.
  useEffect(() => {
    setPortInput(actions.port);
  }, [actions.port]);

  // Auto-expand only when the connection actively fails (not on initial idle).
  // This avoids fighting the WelcomeCard for screen real estate on first run.
  useEffect(() => {
    if (state.connection.status === 'disconnected') setOpen(true);
  }, [state.connection.status]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void actions.reconnect(portInput);
  };

  const dotClass = `pill-dot pill-dot--${state.connection.status}`;
  const portValid = portInput.length === 0 || isValidPort(portInput);

  return (
    <div className={`connection-pill ${open ? 'connection-pill--open' : ''}`}>
      <button
        type="button"
        className="pill-summary ghost-button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={state.connection.detail}
      >
        <span className={dotClass} aria-hidden />
        {state.connection.status === 'connected' ? `:${actions.port}` : labelFor(state.connection.status)}
      </button>
      <form className="pill-popover" onSubmit={onSubmit} hidden={!open}>
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
          <button
            id="openBrowserInlineButton"
            type="button"
            className="ghost-button browser-open-button"
            disabled={state.connection.status !== 'connected'}
            onClick={() => void actions.openWolfBrowser()}
          >
            {state.runtime.browser.status === 'ready' ? 'Show wolf browser' : 'Open wolf browser'}
          </button>
      </form>
    </div>
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
