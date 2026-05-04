import type { Page } from 'playwright';

export type ServeBrowserStatusValue = 'not_started' | 'wrong_instance' | 'ready' | 'todo';

export interface ServeBrowserStatus {
  status: ServeBrowserStatusValue;
  detail: string;
  requiredAction: string;
}

export interface ServeTabSummary {
  id: string;
  title: string;
  url: string;
  tabId: string;
  windowId: null;
  company: string;
}

export interface ServeTabQueues {
  filling: ServeTabSummary[];
  ready: ServeTabSummary[];
  stuck: ServeTabSummary[];
}

export interface ServeBrowserManager {
  status(): ServeBrowserStatus;
  open(): Promise<ServeBrowserStatus>;
  openUrl(url: string): Promise<ServeTabSummary>;
  listTabs(): Promise<{ queues: ServeTabQueues }>;
  focusTab(tabId: string): Promise<ServeTabSummary>;
  getPage(tabId: string): Promise<Page | null>;
  stop(): Promise<void>;
}
