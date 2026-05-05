# wolf companion

The wolf companion is a Chrome MV3 side panel extension that drives wolf
from inside the browser. It talks to a local `wolf serve` daemon over
`http://127.0.0.1:<port>` and never reaches the public internet on its
own.

## What it gives you

- One panel, one next step. The Hero card always shows the single
  most-relevant action for where you are in the workflow:
  Connect → Import → Process → Tailor.
- A 4-segment progress strip in the top bar so you can see where you
  are at a glance.
- A roadmap section (Score / Autofill / Reach out) that names what is
  coming next instead of presenting half-built buttons.
- An activity log that tells you exactly what wolf just did.

## Why wolf opens a separate Chrome window

When you click **Open wolf browser**, wolf launches a **separate Google
Chrome instance** with a wolf-owned persistent profile under your
workspace (`<workspace>/data/wolf-browser-profile/`). It does **not**
reuse your day-to-day Chrome.

We chose this honestly because the alternatives are worse:

1. **Chrome's user-data-dir lock**. Playwright (the engine wolf uses to
   drive pages) needs exclusive access to the profile directory. If
   wolf used your main profile while your daily Chrome was open, one of
   them would fail to start. Asking you to close your main Chrome every
   time you want to apply for a job is not a real product.
2. **Google sync contamination**. If your main profile is signed into a
   Google account with Sync on, every page wolf visits would land in
   your personal browsing history and every extension wolf installs
   would propagate to your other devices. We do not want to mutate your
   account state.
3. **Stagehand stability**. wolf will eventually drive forms with
   Stagehand observe + replay. Password managers, ad blockers, and
   privacy extensions installed in your main profile interfere with
   that automation in subtle ways the user community has documented for
   years. A clean profile keeps automation deterministic.
4. **Enterprise MDM**. Some company-managed Chrome installs forbid
   arbitrary `--user-data-dir` flags. Carving out a separate profile
   sidesteps the conflict.

It is one extra setup step (log in once to LinkedIn / Greenhouse /
Workday in the wolf window, install your password manager once if you
want it). After that, the profile persists across `wolf serve` runs
forever.

## First-time setup

1. Install the unpacked extension (`extension/dist/` after `npm run
   build`).
2. Click the wolf companion icon. The side panel opens with a Welcome
   card; click **Got it**.
3. Run `wolf serve` in a terminal. Note the printed port.
4. Click the connection pill in the top right of the side panel,
   paste the port, click **Reconnect**.
5. Click **Open wolf browser**. A separate Chrome window appears.
6. Log in to the job sites you use in *that* window. Optionally install
   your password manager extension there.
7. Open a job posting in the wolf window. Click **Import** in the side
   panel. The Hero advances to **Process** → **Tailor**.

The companion remembers your port across sessions. The wolf browser
profile persists.

## Architecture

The side panel is a Vite + React 18 application built with the
`@crxjs/vite-plugin`. State lives in a single `useReducer` exposed
through Context; effects (heartbeat, run polling, Chrome tab
listeners) are isolated as hooks under `extension/src/sidepanel/hooks/`.
Apple-style design tokens live in `extension/tailwind.config.ts` and
`extension/src/sidepanel/styles/index.css`. Animations use
`framer-motion`; icons come from `lucide-react`.

The companion has a **demo mode**: when run as a regular static-served
HTML page (no `chrome.runtime` available) it falls back to
`localStorage` and the host page's `document` instead of the Chrome
extension APIs. This makes the visual-review harness possible without
loading the extension.

## Visual review

A Playwright-driven harness under `extension/test/visual/` captures
every UI phase across three real Chrome side panel widths. Run:

```bash
cd extension && npm run review
```

The harness boots a mock daemon, static-serves the build, and renders
8 named scenarios × 3 viewports = 24 screenshots. Output lands in
`extension/test/visual/snapshots/current/` plus a `report.md` table.

## FAQ

**Can I copy my main Chrome profile into the wolf profile?** Technically
yes — same OS user, same OSCrypt key — but we recommend against it for
the reasons above (Chrome lock, Sync contamination, Stagehand
interference). Set up the wolf profile fresh; it pays back within an
hour.

**Where does the companion store its port?** In
`chrome.storage.local` when running as the real extension; in
`window.localStorage` (`wolfServePort`) in demo mode.

**Will the wolf browser show up in my Chrome history sync?** No. The
wolf profile is its own user-data-dir and is not signed into your
Google account by default.
