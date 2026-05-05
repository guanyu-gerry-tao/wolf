import { useEffect, useRef } from 'react';
import { useCompanionState } from '../state/StateContext';
import type { CompanionActions } from './useCompanionActions';
import { HEARTBEAT_MS } from '../utils';

interface ConnectionEffectInput {
  port: string;
  refresh: CompanionActions['refresh'];
  ping: () => Promise<unknown>;
  log: (msg: string) => void;
}

/**
 * Background heartbeat loop. Runs every 5s while the connection is in
 * `connected` state. On a successful ping refreshes runtime/inbox/queues;
 * on failure flips the connection to `disconnected` and lets the UI prompt
 * the user to reconnect manually.
 */
export function useDaemonHeartbeat(input: ConnectionEffectInput) {
  const { state, dispatch } = useCompanionState();
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    if (state.connection.status !== 'connected') return;
    const id = setInterval(async () => {
      const { ping, refresh, log } = inputRef.current;
      try {
        await ping();
        await refresh.runtime();
        await refresh.inbox();
        await refresh.queues();
      } catch {
        dispatch({
          type: 'set-connection',
          connection: { status: 'disconnected', detail: 'Lost connection to wolf serve.' },
        });
        log('Lost connection to wolf serve.');
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [state.connection.status, dispatch]);
}
