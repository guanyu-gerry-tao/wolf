// Shape mirrors the legacy main.js `state` object so the migration is
// behavior-preserving. New names are kept identical to the legacy field
// names where possible to keep diffs reviewable.

export type ConnectionStatus = 'idle' | 'connected' | 'disconnected';

export interface ConnectionState {
  status: ConnectionStatus;
  detail: string;
}

export type RuntimeBrowserStatus = 'unknown' | 'not_started' | 'starting' | 'ready' | string;

export interface EnvKeyStatus {
  present: boolean;
  envVarName: string;
}

export interface RuntimeState {
  browser: {
    status: RuntimeBrowserStatus;
    detail: string;
    requiredAction: string;
  };
  /** Optional because older daemons (or the very first runtime/status
   * payload before the daemon enriches it) won't carry the field. */
  env?: {
    anthropic: EnvKeyStatus;
  };
}

export interface CurrentTabInfo {
  title: string;
  url: string;
  id: number | null;
  windowId: number | null;
}

export type CurrentPageStatus =
  | { kind: 'normal'; detail: null }
  | {
      kind: 'duplicate';
      detail: {
        inboxId: string;
        jobId: string | null;
        status: string;
        title: string;
        url: string;
      };
    }
  | { kind: 'aggregator'; detail: string };

export interface InboxState {
  hasRaw: boolean;
  rawCount: number;
}

export interface TailorState {
  untailoredJobCount: number;
}

export type View = 'main' | 'artifact-edit' | 'config';

export type ArtifactKind = 'resume' | 'cover-letter';

export interface ArtifactStatus {
  status: 'not_ready' | 'ready' | string;
  url: string | null;
}

export interface ArtifactsState {
  resume: ArtifactStatus;
  coverLetter: ArtifactStatus;
}

export interface ActiveRunUi {
  buttonId: string;
  stepProgress?: string;
  stepKicker?: string;
  completeLabel?: string;
  failedLabel?: string;
  resetLabel?: string;
  disableOnComplete?: boolean;
}

export interface QueueItem {
  id: string;
  jobId: string | null;
  title: string;
  company: string;
  url: string | null;
  tabId: number | null;
  windowId: number | null;
}

export interface QueuesState {
  filling: QueueItem[];
  ready: QueueItem[];
  stuck: QueueItem[];
}

export interface ButtonOverride {
  label?: string;
  disabled?: boolean;
  variant?: 'success' | 'warning' | null;
  // when set, the override clears itself on the next state recomputation.
  expiresAt?: number;
}

export interface ActivityEntry {
  id: number;
  timestamp: string;
  message: string;
}

export interface CompanionState {
  port: string;
  connection: ConnectionState;
  runtime: RuntimeState;
  currentTab: CurrentTabInfo | null;
  activeWolfTabId: number | null;
  currentPageStatus: CurrentPageStatus;
  currentJobId: string | null;
  inbox: InboxState;
  tailor: TailorState;
  view: View;
  activeArtifactKind: ArtifactKind | null;
  activeRunId: string | null;
  activeRunUi: ActiveRunUi | null;
  artifacts: ArtifactsState;
  queues: QueuesState;
  /** Transient overrides applied to action buttons (e.g. "Imported", "Importing..."). */
  buttonOverrides: Record<string, ButtonOverride>;
  /** Bounded activity log shown in the footer. */
  activity: ActivityEntry[];
  /** Open prompt boxes by anchor button id. */
  promptOpen: { tailor: boolean; fill: boolean };
  /** Live values of the prompt textareas (so legacy "send" branch can read them). */
  promptText: { tailor: string; fill: string; artifactEdit: string };
}

export type Action =
  | { type: 'set-port'; port: string }
  | { type: 'set-connection'; connection: ConnectionState }
  | { type: 'set-runtime'; runtime: RuntimeState }
  | { type: 'set-current-tab'; tab: CurrentTabInfo | null }
  | { type: 'set-current-page-status'; status: CurrentPageStatus }
  | { type: 'set-current-job-id'; jobId: string | null }
  | { type: 'set-inbox'; inbox: InboxState }
  | { type: 'set-tailor-counts'; tailor: TailorState }
  | { type: 'set-queues'; queues: QueuesState }
  | { type: 'set-artifacts'; artifacts: Partial<ArtifactsState> }
  | { type: 'set-view'; view: View; artifactKind?: ArtifactKind | null }
  | { type: 'set-active-run'; runId: string | null; ui: ActiveRunUi | null }
  | { type: 'log'; message: string }
  | { type: 'open-prompt'; which: 'tailor' | 'fill' }
  | { type: 'close-prompt'; which: 'tailor' | 'fill' }
  | { type: 'set-prompt-text'; which: 'tailor' | 'fill' | 'artifactEdit'; text: string }
  | { type: 'override-button'; buttonId: string; override: ButtonOverride | null };

export const initialState: CompanionState = {
  port: '47823',
  connection: { status: 'idle', detail: 'Waiting for local wolf serve.' },
  runtime: {
    browser: {
      status: 'unknown',
      detail: 'Connect to wolf serve first.',
      requiredAction: 'Start wolf serve, then reconnect.',
    },
  },
  currentTab: null,
  activeWolfTabId: null,
  currentPageStatus: { kind: 'normal', detail: null },
  currentJobId: null,
  inbox: { hasRaw: false, rawCount: 0 },
  tailor: { untailoredJobCount: 0 },
  view: 'main',
  activeArtifactKind: null,
  activeRunId: null,
  activeRunUi: null,
  artifacts: {
    resume: { status: 'not_ready', url: null },
    coverLetter: { status: 'not_ready', url: null },
  },
  queues: { filling: [], ready: [], stuck: [] },
  buttonOverrides: {},
  activity: [],
  promptOpen: { tailor: false, fill: false },
  promptText: { tailor: '', fill: '', artifactEdit: '' },
};
