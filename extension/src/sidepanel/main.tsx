import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// S2a entry point. React renders the App shell synchronously, then we kick
// off the legacy main.js dynamically — by that time querySelector will find
// the React-rendered DOM. main.js is migrated to hooks across S2b commits;
// for now it stays as the single source of behavioral truth so this commit
// preserves S1 behavior 1:1.
//
// StrictMode is intentionally OFF for now: legacy main.js attaches plain
// addEventListener handlers which would double-register under strict-mode
// development double-mounting. Strict mode comes back in S2b when handlers
// are owned by React.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('wolf companion: missing #root mounting node.');
}

createRoot(rootElement).render(<App />);

// Fire-and-forget: legacy script reads the DOM and wires events. We do this
// in a microtask after render so commit-phase DOM is in place. crxjs picks
// up this dynamic import and emits a chunk for it.
queueMicrotask(() => {
  void import('./main.js');
});

// StrictMode import is kept above to make the eventual flip back trivial.
void StrictMode;
