import type { CompanionState } from './types';

// AppPhase is derived from the existing CompanionState. Adding a derived
// helper (instead of a new reducer field) keeps state minimal and avoids
// drift between phase and the underlying flags.

export type AppPhase =
  | 'first-run'
  | 'disconnected'
  | 'connecting'
  | 'runtime-not-ready'
  | 'missing-api-key'
  | 'connected-empty'
  | 'has-imports'
  | 'has-processed'
  | 'has-tailored'
  | 'run-active';

export function computeAppPhase(state: CompanionState, firstRunSeen: boolean): AppPhase {
  if (!firstRunSeen) return 'first-run';
  if (state.connection.status === 'idle') return 'connecting';
  if (state.connection.status !== 'connected') return 'disconnected';
  if (state.runtime.browser.status !== 'ready') return 'runtime-not-ready';
  // Once the daemon + browser are both ready, gate on API-key presence
  // before letting the user enter any phase that triggers a paid Claude
  // call. The daemon would otherwise reject Process / Tailor with
  // MissingApiKeyError after the click — we surface the fix earlier.
  if (state.runtime.env && !state.runtime.env.anthropic.present) return 'missing-api-key';
  if (state.activeRunId) return 'run-active';
  if (state.inbox.hasRaw) return 'has-imports';
  if (state.tailor.untailoredJobCount > 0) return 'has-processed';
  if (state.queues.ready.length > 0) return 'has-tailored';
  return 'connected-empty';
}

/** Index of the active progress segment (0-3) for the 4-step strip. */
export function progressIndex(phase: AppPhase): number {
  switch (phase) {
    case 'first-run':
    case 'disconnected':
    case 'connecting':
    case 'runtime-not-ready':
    case 'missing-api-key':
      return 0;
    case 'connected-empty':
      return 0;
    case 'has-imports':
      return 1;
    case 'has-processed':
    case 'run-active':
      return 2;
    case 'has-tailored':
      return 3;
  }
}
