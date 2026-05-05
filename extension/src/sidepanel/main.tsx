import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

// S2b entry point. All behavior is now owned by React hooks (see hooks/*).
// StrictMode is on so cleanup correctness for heartbeat + run polling is
// validated during development double-mount.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('wolf companion: missing #root mounting node.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
