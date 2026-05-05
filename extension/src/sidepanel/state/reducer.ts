import type { Action, CompanionState } from './types';

let nextActivityId = 0;

// Bounded activity log size; matches legacy behavior of trimming after 6.
const ACTIVITY_MAX_ENTRIES = 6;

export function reducer(state: CompanionState, action: Action): CompanionState {
  switch (action.type) {
    case 'set-port':
      return { ...state, port: action.port };

    case 'set-connection': {
      const { connection } = action;
      // When the connection drops, clear runtime-dependent data so the UI
      // does not pretend the daemon is still serving stale info.
      if (connection.status !== 'connected') {
        return {
          ...state,
          connection,
          activeWolfTabId: null,
          runtime: {
            browser: {
              status: 'unknown',
              detail: 'Connect to wolf serve first.',
              requiredAction: 'Start wolf serve, then reconnect.',
            },
          },
          inbox: { hasRaw: false, rawCount: 0 },
          currentJobId: null,
          activeRunId: null,
          activeRunUi: null,
        };
      }
      return { ...state, connection };
    }

    case 'set-runtime':
      return { ...state, runtime: action.runtime };

    case 'set-current-tab':
      return { ...state, currentTab: action.tab };

    case 'set-current-page-status':
      return { ...state, currentPageStatus: action.status };

    case 'set-current-job-id':
      return { ...state, currentJobId: action.jobId };

    case 'set-inbox':
      return { ...state, inbox: action.inbox };

    case 'set-tailor-counts':
      return { ...state, tailor: action.tailor };

    case 'set-queues':
      return { ...state, queues: action.queues };

    case 'set-artifacts':
      return {
        ...state,
        artifacts: {
          resume: action.artifacts.resume ?? state.artifacts.resume,
          coverLetter: action.artifacts.coverLetter ?? state.artifacts.coverLetter,
        },
      };

    case 'set-view':
      return {
        ...state,
        view: action.view,
        activeArtifactKind: action.artifactKind ?? null,
        // Closing the artifact-edit view also clears its prompt text so the
        // next open is empty (legacy: setArtifactEditMode resets the input).
        promptText: action.view === 'main'
          ? { ...state.promptText, artifactEdit: '' }
          : state.promptText,
      };

    case 'set-active-run':
      return { ...state, activeRunId: action.runId, activeRunUi: action.ui };

    case 'log': {
      const entry = {
        id: ++nextActivityId,
        timestamp: new Date().toLocaleTimeString(),
        message: action.message,
      };
      const next = [entry, ...state.activity].slice(0, ACTIVITY_MAX_ENTRIES);
      return { ...state, activity: next };
    }

    case 'open-prompt':
      return {
        ...state,
        promptOpen: { ...state.promptOpen, [action.which]: true },
      };

    case 'close-prompt':
      return {
        ...state,
        promptOpen: { ...state.promptOpen, [action.which]: false },
        promptText: { ...state.promptText, [action.which]: '' },
      };

    case 'set-prompt-text':
      return {
        ...state,
        promptText: { ...state.promptText, [action.which]: action.text },
      };

    case 'override-button': {
      const next = { ...state.buttonOverrides };
      if (action.override === null) {
        delete next[action.buttonId];
      } else {
        next[action.buttonId] = action.override;
      }
      return { ...state, buttonOverrides: next };
    }

    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}
