import fs from 'node:fs/promises';
import { chromium, type BrowserContext, type Page } from 'playwright';
import type {
  ServeBrowserManager,
  ServeBrowserStatus,
  ServeTabSummary,
} from '../browserManager.js';

export class PlaywrightBrowserManagerImpl implements ServeBrowserManager {
  private context: BrowserContext | null = null;
  private readonly pageIds = new WeakMap<Page, string>();
  private readonly pagesById = new Map<string, Page>();
  private readonly pagesByRequestedUrl = new Map<string, Page>();
  private nextPageId = 1;

  constructor(
    private readonly userDataDir: string,
    private readonly startupUrl: string | null = null,
  ) {}

  status(): ServeBrowserStatus {
    if (!this.context) {
      return {
        status: 'not_started',
        detail: 'Wolf browser is not running yet.',
        requiredAction: 'Click Reconnect after starting wolf serve, or call POST /api/browser/open.',
      };
    }
    return {
      status: 'ready',
      detail: `Wolf browser is running in Google Chrome with profile ${this.userDataDir}.`,
      requiredAction: 'Use the wolf Chrome window for application pages.',
    };
  }

  async open(): Promise<ServeBrowserStatus> {
    if (this.context) {
      const page = this.context.pages()[0] ?? await this.context.newPage();
      await page.bringToFront().catch(() => undefined);
      return this.status();
    }

    await fs.mkdir(this.userDataDir, { recursive: true });
    try {
      this.context = await chromium.launchPersistentContext(this.userDataDir, {
        channel: 'chrome',
        headless: false,
        ignoreDefaultArgs: ['--disable-extensions'],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        'Wolf Browser could not start Google Chrome. Install Google Chrome, then run wolf serve again. ' +
        `Original error: ${message}`,
      );
    }
    this.context.on('page', (page) => this.rememberPage(page));

    const page = this.context.pages()[0] ?? await this.context.newPage();
    this.rememberPage(page);
    await page.goto(this.startupUrl ?? 'about:blank').catch(() => undefined);
    return this.status();
  }

  async openUrl(url: string): Promise<ServeTabSummary> {
    await this.open();
    if (!this.context) throw new Error('Wolf browser is not running.');
    const existing = this.pagesByRequestedUrl.get(url);
    if (existing && !existing.isClosed()) {
      await existing.bringToFront().catch(() => undefined);
      return this.toSummary(existing);
    }
    const page = await this.context.newPage();
    this.rememberPage(page);
    this.pagesByRequestedUrl.set(url, page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => undefined);
    await page.bringToFront().catch(() => undefined);
    return this.toSummary(page);
  }

  async listTabs(): Promise<{ queues: { filling: ServeTabSummary[]; ready: ServeTabSummary[]; stuck: ServeTabSummary[] } }> {
    if (!this.context) return { queues: { filling: [], ready: [], stuck: [] } };
    const pages = this.context.pages();
    return {
      queues: {
        filling: await Promise.all(pages.map((page) => this.toSummary(page))),
        ready: [],
        stuck: [],
      },
    };
  }

  async focusTab(tabId: string): Promise<ServeTabSummary> {
    if (!this.context) throw new Error('Wolf browser is not running.');
    const page = this.pagesById.get(tabId);
    if (!page) throw new Error(`Wolf browser tab not found: ${tabId}`);
    await page.bringToFront();
    return this.toSummary(page);
  }

  async getPage(tabId: string): Promise<Page | null> {
    if (!this.context) return null;
    if (tabId) return this.pagesById.get(tabId) ?? null;
    return this.context.pages()[0] ?? null;
  }

  async stop(): Promise<void> {
    if (!this.context) return;
    await this.context.close();
    this.context = null;
    this.pagesById.clear();
    this.pagesByRequestedUrl.clear();
  }

  private rememberPage(page: Page): string {
    const existing = this.pageIds.get(page);
    if (existing) return existing;
    const id = `wolf-tab-${this.nextPageId}`;
    this.nextPageId += 1;
    this.pageIds.set(page, id);
    this.pagesById.set(id, page);
    page.once('close', () => {
      this.pagesById.delete(id);
      for (const [url, candidate] of this.pagesByRequestedUrl.entries()) {
        if (candidate === page) this.pagesByRequestedUrl.delete(url);
      }
    });
    return id;
  }

  private async toSummary(page: Page): Promise<ServeTabSummary> {
    const id = this.rememberPage(page);
    const title = await page.title().catch(() => '') || 'Wolf browser tab';
    const url = page.url();
    return {
      id,
      title,
      url,
      tabId: id,
      windowId: null,
      company: hostFromUrl(url),
    };
  }
}

function hostFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname || 'Wolf Browser';
  } catch {
    return 'Wolf Browser';
  }
}
