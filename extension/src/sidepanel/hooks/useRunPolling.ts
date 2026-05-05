import { useEffect, useRef } from 'react';
import { useCompanionState } from '../state/StateContext';
import type { CompanionActions } from './useCompanionActions';
import { RUN_POLL_MS, errorMessage } from '../utils';

interface RunPollingInput {
  refresh: CompanionActions['refresh'];
  fetchWithTimeout: (path: string, options?: RequestInit) => Promise<Response>;
  log: (msg: string) => void;
}

interface RunStatusBody {
  status?: 'ready' | 'failed' | 'running' | string;
  type?: string;
  artifacts?: {
    resume?: { status: string; url: string | null };
    coverLetter?: { status: string; url: string | null };
  };
  error?: string;
  todo?: string;
}

/**
 * Polls /api/runs/{activeRunId} every 5s while a run is active. On
 * terminal status (ready or failed) it logs the result, applies a final
 * button label override (via the activeRunUi hint stored when the run
 * started), refreshes queues + artifacts, and clears the active run.
 */
export function useRunPolling(input: RunPollingInput) {
  const { state, dispatch } = useCompanionState();
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    const runId = state.activeRunId;
    if (!runId) return;
    let cancelled = false;

    const tick = async () => {
      const { fetchWithTimeout, refresh, log } = inputRef.current;
      try {
        const res = await fetchWithTimeout(`/api/runs/${encodeURIComponent(runId)}`);
        const body = await res.json().catch(() => ({})) as RunStatusBody;
        if (!res.ok && body.status === 'todo') {
          log(body.todo ?? 'Run polling is not implemented yet.');
          if (!cancelled) dispatch({ type: 'set-active-run', runId: null, ui: null });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        log(`Run ${runId}: ${body.status ?? 'unknown'}`);
        if (body.artifacts) {
          dispatch({
            type: 'set-artifacts',
            artifacts: {
              resume: body.artifacts.resume,
              coverLetter: body.artifacts.coverLetter,
            },
          });
        }
        if (body.status === 'ready' || body.status === 'failed') {
          if (body.status === 'failed') {
            log(body.error ? `Run failed: ${body.error}` : 'Run failed.');
            if (body.type === 'tailor') {
              log('For failed tailor jobs, open the job and use Tailor this job instantly.');
            } else if (body.type === 'inbox_promote') {
              log('For failed inbox items, import that page again, then run Process Inbox.');
            }
          }
          // Apply the completion label override stored on the active run UI.
          applyCompletionLabel(state.activeRunUi, body.status, dispatch);
          if (!cancelled) dispatch({ type: 'set-active-run', runId: null, ui: null });
          await refresh.queues();
          await refresh.artifacts();
        }
      } catch (err) {
        log(`Run status check failed: ${errorMessage(err)}`);
      }
    };

    // Fire one immediate poll so the user does not wait the full interval
    // on the very first transition to ready/failed.
    void tick();
    const id = setInterval(() => {
      if (!cancelled) void tick();
    }, RUN_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [state.activeRunId, state.activeRunUi, dispatch]);
}

function applyCompletionLabel(
  ui: { buttonId: string; completeLabel?: string; failedLabel?: string; resetLabel?: string; disableOnComplete?: boolean } | null,
  status: 'ready' | 'failed',
  dispatch: (action: { type: 'override-button'; buttonId: string; override: { label: string; disabled?: boolean; expiresAt?: number } | null }) => void,
) {
  if (!ui?.buttonId) return;
  if (status === 'ready') {
    dispatch({
      type: 'override-button',
      buttonId: ui.buttonId,
      override: { label: ui.completeLabel ?? 'Ready', disabled: ui.disableOnComplete ?? true },
    });
    return;
  }
  dispatch({
    type: 'override-button',
    buttonId: ui.buttonId,
    override: { label: ui.failedLabel ?? 'Failed' },
  });
  // Schedule a reset to the original label after the legacy 1.8s window.
  const reset = ui.resetLabel ?? '';
  if (reset) {
    setTimeout(() => {
      dispatch({
        type: 'override-button',
        buttonId: ui.buttonId,
        override: null,
      });
    }, 1_800);
  }
}
