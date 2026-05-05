// Named UI scenarios. Each scenario combines a mock-server preset with
// optional in-page setup steps (e.g., dismiss the WelcomeCard so the
// post-onboarding hierarchy becomes visible).

import type { PresetName } from './mockServer';

export interface VisualState {
  /** File-friendly name used in screenshot paths and the report. */
  id: string;
  /** Human description shown in the harness CLI output and report. */
  description: string;
  /** Mock-server preset to load before navigating. */
  preset: PresetName;
  /** localStorage seed so first-run vs returning-user states diverge. */
  firstRunSeen: boolean;
  /** Optional script step run inside the page after navigation. */
  setup?: string;
}

export const VISUAL_STATES: VisualState[] = [
  {
    id: 'first-run',
    description: 'First-run welcome card visible, daemon offline.',
    preset: 'disconnected',
    firstRunSeen: false,
  },
  {
    id: 'disconnected',
    description: 'Welcome dismissed, daemon offline. Shows hero "Connect to wolf serve".',
    preset: 'disconnected',
    firstRunSeen: true,
  },
  {
    id: 'runtime-not-ready',
    description: 'Connected to daemon but wolf browser is not started.',
    preset: 'runtime-not-ready',
    firstRunSeen: true,
    // After mount, click Reconnect inside the popover so connection flips.
    setup: `
      const pill = document.querySelector('.pill-summary');
      pill?.click();
      await new Promise(r => setTimeout(r, 50));
      document.querySelector('#reconnectButton')?.click();
      await new Promise(r => setTimeout(r, 600));
      // Close the pill so the popover does not overlap the Hero in the
      // captured screenshot.
      pill?.click();
      await new Promise(r => setTimeout(r, 100));
    `,
  },
  {
    id: 'connected-empty',
    description: 'Connected, browser ready, no imports yet. Hero asks to Import.',
    preset: 'connected-empty',
    firstRunSeen: true,
    setup: `
      const pill = document.querySelector('.pill-summary');
      pill?.click();
      await new Promise(r => setTimeout(r, 50));
      document.querySelector('#reconnectButton')?.click();
      await new Promise(r => setTimeout(r, 600));
      // Close the pill so the popover does not overlap the Hero in the
      // captured screenshot.
      pill?.click();
      await new Promise(r => setTimeout(r, 100));
    `,
  },
  {
    id: 'has-imports',
    description: 'Three raw imports waiting. Hero shows Process Inbox CTA.',
    preset: 'has-imports',
    firstRunSeen: true,
    setup: `
      const pill = document.querySelector('.pill-summary');
      pill?.click();
      await new Promise(r => setTimeout(r, 50));
      document.querySelector('#reconnectButton')?.click();
      await new Promise(r => setTimeout(r, 600));
      // Close the pill so the popover does not overlap the Hero in the
      // captured screenshot.
      pill?.click();
      await new Promise(r => setTimeout(r, 100));
    `,
  },
  {
    id: 'has-processed',
    description: 'Three Ready jobs untailored. Hero shows Batch Tailor CTA.',
    preset: 'has-processed',
    firstRunSeen: true,
    setup: `
      const pill = document.querySelector('.pill-summary');
      pill?.click();
      await new Promise(r => setTimeout(r, 50));
      document.querySelector('#reconnectButton')?.click();
      await new Promise(r => setTimeout(r, 600));
      // Close the pill so the popover does not overlap the Hero in the
      // captured screenshot.
      pill?.click();
      await new Promise(r => setTimeout(r, 100));
    `,
  },
  {
    id: 'has-tailored',
    description: 'All caught up. Resume + cover letter ready.',
    preset: 'has-tailored',
    firstRunSeen: true,
    setup: `
      const pill = document.querySelector('.pill-summary');
      pill?.click();
      await new Promise(r => setTimeout(r, 50));
      document.querySelector('#reconnectButton')?.click();
      await new Promise(r => setTimeout(r, 600));
      // Close the pill so the popover does not overlap the Hero in the
      // captured screenshot.
      pill?.click();
      await new Promise(r => setTimeout(r, 100));
    `,
  },
  {
    id: 'config-open',
    description: 'Settings modal open over the main view.',
    preset: 'connected-empty',
    firstRunSeen: true,
    setup: `
      const pill = document.querySelector('.pill-summary');
      pill?.click();
      await new Promise(r => setTimeout(r, 50));
      document.querySelector('#reconnectButton')?.click();
      await new Promise(r => setTimeout(r, 400));
      document.querySelector('#configButton')?.click();
      await new Promise(r => setTimeout(r, 200));
    `,
  },
];
