import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const extensionRoot = path.resolve(process.cwd(), 'extension');

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(extensionRoot, relativePath), 'utf-8');
}

describe('companion side panel MVP', () => {
  // Pins the unpacked-extension contract: Chrome should be able to load the
  // source directory directly while the Phase 1 MVP is still buildless.
  it('declares a MV3 side panel and global action entry', async () => {
    const manifest = JSON.parse(await readText('manifest.json')) as {
      manifest_version: number;
      side_panel?: { default_path?: string };
      action?: { default_title?: string };
      background?: { service_worker?: string; type?: string };
      permissions?: string[];
      host_permissions?: string[];
      optional_host_permissions?: string[];
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.side_panel?.default_path).toBe('src/sidepanel/index.html');
    expect(manifest.action?.default_title).toContain('wolf');
    expect(manifest.background?.service_worker).toBe('src/background/index.js');
    expect(manifest.background?.type).toBe('module');
    expect(manifest.permissions).toEqual(expect.arrayContaining([
      'sidePanel',
      'tabs',
      'activeTab',
      'scripting',
      'storage',
    ]));
    expect(manifest.host_permissions).toEqual(expect.arrayContaining([
      'http://127.0.0.1/*',
      'http://localhost/*',
    ]));
    expect(manifest.optional_host_permissions).toEqual(expect.arrayContaining([
      'http://*/*',
      'https://*/*',
    ]));
  });

  // The side panel must expose the actual MVP controls instead of being just a
  // placeholder shell.
  it('renders connection, queue, import, batch, and preview controls', async () => {
    const html = await readText('src/sidepanel/index.html');
    const js = await readText('src/sidepanel/main.js');

    expect(html).toContain('id="portInput"');
    expect(html).toContain('id="reconnectButton"');
    expect(html).toContain('value="47823"');
    expect(html).toContain('Start <strong>wolf serve</strong>');
    expect(html).toContain('id="runtimeOverlay"');
    expect(html).toContain('⚠️ wolf browser is not ready');
    expect(html).toContain('Start the browser from wolf serve, then reconnect.');
    expect(html).toContain('id="openBrowserButton"');
    expect(html).toContain('Open wolf browser');
    expect(html).toContain('id="configButton"');
    expect(html).toContain('Config');
    expect(html).toContain('id="duplicateNotice"');
    expect(html).toContain('id="importCurrentPageButton"');
    expect(html).toContain('id="processInboxButton"');
    expect(html).toContain('Process Inbox');
    expect(html).toContain('id="previewResumeButton"');
    expect(html).toContain('id="previewCoverLetterButton"');
    expect(html).toContain('id="tailorInstantButton"');
    expect(html).toContain('Tailor this job instantly');
    expect(html).toContain('id="tailorPromptBox"');
    expect(html).toContain('id="tailorPromptInput"');
    expect(html).toContain('Optional one-shot instructions');
    expect(html).toContain('id="refreshRunStatusButton"');
    expect(html).toContain('Refresh status');
    expect(html).toContain('id="batchTailorButton"');
    expect(html).toContain('Batch Tailor');
    expect(html).toContain('id="autofillQuickButton"');
    expect(html).toContain('Autofill this page');
    expect(html).toContain('Optional page-specific instructions. wolf will fill the form but will not submit it.');
    expect(html).toContain('id="artifactEditPanel"');
    expect(html).toContain('Artifact Editor');
    expect(html).toContain('One-shot edit only. This editor does not remember previous changes.');
    expect(html).toContain('id="regenerateArtifactButton"');
    expect(html).toContain('id="configPanel"');
    expect(html).toContain('Companion Config');
    expect(html).toContain('Saved to wolf.toml as the default profile name.');
    expect(html).toContain('Max parallel Stagehand sessions');
    expect(html).toContain('Stagehand LOCAL session pooling is a TODO');
    expect(html).toContain('wolf should automate only the wolf-controlled Chrome instance');
    expect(html).toContain('data-column="filling"');
    expect(html).toContain('data-column="ready"');
    expect(html).toContain('data-column="stuck"');

    expect(js).toContain('/api/tabs');
    expect(js).toContain('/focus');
    expect(js).toContain('/api/ping');
    expect(js).toContain('/api/runtime/status');
    expect(js).toContain('/api/browser/open');
    expect(js).toContain('/api/inbox/items');
    expect(js).toContain('/api/inbox/process');
    expect(js).toContain('/api/tailor/quick');
    expect(js).toContain('/api/tailor/batch');
    expect(js).toContain('/api/fill/quick');
    expect(js).toContain('/api/artifacts/regenerate');
    expect(js).toContain('/api/config');
    expect(js).toContain('/api/runs/');
    expect(js).toContain('/api/inbox/duplicate-check');
    expect(js).toContain('Future AI extraction may use paid batch API calls');
    expect(js).toContain('Process raw inbox items into jobs?');
    expect(js).toContain('Inbox processing queued');
    expect(js).toContain('artifactTargets');
    expect(js).toContain('Instant tailor unavailable');
    expect(js).toContain('Sending...');
    expect(js).toContain('Tailoring...');
    expect(js).toContain('RUN_POLL_MS');
    expect(js).toContain('startRunPolling');
    expect(js).toContain('stopRunPolling');
    expect(js).toContain('Run polling is not implemented yet.');
    expect(js).toContain('Batch tailor');
    expect(js).toContain('Autofill started with no auto-submit');
    expect(js).toContain('existingArtifactText');
    expect(js).toContain('Regenerating...');
    expect(js).toContain('showMainView');
    expect(js).toContain('openConfig');
    expect(js).toContain('Config write is not implemented yet.');
    expect(js).toContain('Config saved: port and default profile.');
    expect(js).toContain('No filling pages yet.');
    expect(js).toContain('Wolf browser tab registry is not implemented yet.');
    expect(js).toContain('/artifacts');
    expect(js).toContain('${label} Not Ready');
    expect(js).toContain('renderArtifactButtons');
    expect(js).toContain('Artifact readiness is not implemented yet.');
    expect(js).toContain('Importing...');
    expect(js).toContain('Already Imported');
    expect(js).toContain('Please check');
    expect(js).toContain(`document.createElement('a')`);
    expect(js).toContain('noopener noreferrer');
    expect(js).toContain('company application page');
    expect(js).toContain('Imported page to wolf inbox');
    expect(js).toContain('Aggregator listing detected');
    expect(js).toContain('LinkedIn');
    expect(js).toContain('Handshake');
    expect(js).toContain('chromeApi.permissions.request');
    expect(js).toContain('Import failed:');
    expect(js).toContain('Chrome runtime said');
    expect(js).toContain('Cannot import this tab');
    expect(js).toContain('Connect to wolf serve first.');
    expect(js).toContain('Start the browser from wolf serve, then reconnect.');
    expect(js).toContain('isRuntimeReady');
    expect(js).toContain('activeWolfTabId');
    expect(js).toContain('Wolf browser is ready. Use that window for application pages.');
    expect(js).toContain('Lost connection to wolf serve.');
    expect(js).toContain('HEARTBEAT_MS');
    expect(js).toContain('/api/jobs/');
    expect(js).toContain("kind === 'resume' ? 'resume' : 'cover-letter'");
    expect(js).toContain('/artifacts/${artifactPath}');
  });

  // The queue should read as a compact kanban board without forcing the whole
  // Chrome side panel to horizontally scroll on narrow widths.
  it('styles the queue as a responsive three-column kanban board', async () => {
    const css = await readText('src/sidepanel/styles.css');

    expect(css).toContain('overflow-x: hidden');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(124px, 1fr))');
    expect(css).toContain('grid-template-rows: auto 1fr');
    expect(css).toContain('scroll-snap-type: x proximity');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('grid-template-columns: 74px minmax(0, 1fr)');
    expect(css).toContain('-webkit-line-clamp: 3');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(css).toContain('white-space: nowrap');
    expect(css).toContain('#importCurrentPageButton');
    expect(css).toContain('#processInboxButton');
    expect(css).toContain('#tailorInstantButton');
    expect(css).toContain('#refreshRunStatusButton');
    expect(css).toContain('.prompt-box');
    expect(css).toContain('.prompt-help');
    expect(css).toContain('.edit-panel');
    expect(css).toContain('.config-panel');
    expect(css).toContain('.prompt-warning');
    expect(css).toContain('.form-section');
    expect(css).toContain('.ghost-button');
    expect(css).toContain('[hidden]');
    expect(css).toContain('.empty-state');
    expect(css).toContain('grid-column: 1 / -1');
    expect(css).toContain('button:disabled');
    expect(css).toContain('button.button-warning');
    expect(css).toContain('button.button-success');
    expect(css).toContain('.page-notice--success');
    expect(css).toContain('.page-notice--warning');
    expect(css).toContain('.page-notice a');
    expect(css).toContain('text-decoration: underline');
    expect(css).toContain('.runtime-overlay');
    expect(css).toContain('backdrop-filter: blur(2px)');
    expect(css).toContain('.runtime-warning');
  });
});
