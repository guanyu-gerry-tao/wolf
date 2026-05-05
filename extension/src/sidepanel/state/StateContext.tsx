import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import { initialState, type Action, type CompanionState } from './types';
import { reducer } from './reducer';

interface StateContextValue {
  state: CompanionState;
  dispatch: Dispatch<Action>;
  log: (message: string) => void;
}

const StateContext = createContext<StateContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  initial?: CompanionState;
}

export function CompanionStateProvider({ children, initial }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, initial ?? initialState);

  // Stable reference to dispatch + a convenience log helper. Keeping this
  // out of the value object avoids re-creating the closure each render.
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const log = useCallback((message: string) => {
    dispatchRef.current({ type: 'log', message });
  }, []);

  return (
    <StateContext.Provider value={{ state, dispatch, log }}>
      {children}
    </StateContext.Provider>
  );
}

export function useCompanionState(): StateContextValue {
  const ctx = useContext(StateContext);
  if (!ctx) {
    throw new Error('useCompanionState must be used inside <CompanionStateProvider>.');
  }
  return ctx;
}
