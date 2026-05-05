# Companion redesign — manual acceptance plan

One-shot human acceptance for the React + Apple-style redesign PR. Run
this **once** before merging `companion-redesign` to main. Follow-up
regressions are caught by `npm run review` (state matrix harness) and
the unit tests; this doc is the real-Chrome end-to-end pass.

> Time estimate: 10 min for the core path (阶段 0–5 + 8 + 10),
> ~45 min if you want the paid Process + Tailor AI calls included.

---

## Stage 0 — Prep (5 min)

```bash
cd /Users/guanyutao/developers/personal-projects/wolf/.claude/worktrees/wonderful-fermi-1a9b2d
git branch --show-current   # → companion-redesign
git log --oneline -10       # S1..S8 visible
npm install
npm run build --workspace=@wolf/companion
ls extension/dist/          # manifest.json + service-worker-loader.js + src/sidepanel/index.html
```

**Pass:** `extension/dist/manifest.json` and `dist/src/sidepanel/index.html` exist.

---

## Stage 1 — Load into real Chrome (5 min)

1. `chrome://extensions` → **Developer mode** on
2. **Load unpacked** → select `extension/dist`
3. Extension list shows "**wolf companion** v0.0.23" with no red error banner
4. Pin the wolf icon to the toolbar

**Pass:** No errors, icon visible, service worker shows **inactive** (normal).

---

## Stage 2 — First open + Welcome card (2 min)

1. Click the wolf icon → side panel opens
2. WelcomeCard appears with spring entrance:
   - "WELCOME" eyebrow / "wolf is your job hunt copilot" title / 30-word body / 1-2-3 list / blue **Got it** button

**Visual checks:**
- [ ] System font (SF Pro on macOS)
- [ ] **Got it** is Apple system blue `#0a84ff`
- [ ] Panels use shadow-only elevation (no 1px solid borders)

3. Click **Got it** → card animates out
4. DevTools → Application → Local Storage: `wolf.firstRunSeen=true`

**Pass:** Card shows once, dismisses cleanly, never returns on reopen.

---

## Stage 3 — Disconnected state (2 min)

Right-click panel → **Inspect**. Then:

1. **TopBar:** brand left + connection pill (red dot · "Offline") + gear right + 4-segment ProgressStrip below
2. **Hero:** "STEP 1 OF 4 / Connect to wolf serve" + body mentioning `wolf serve`
3. **Roadmap (scroll down):** 3 cards — Score / Autofill / Reach out — each with 🔒 icon and blue timeline label; hover shifts opacity 0.78 → 1

**Pass:** Console has no red errors. Allowed: fetch failures to `127.0.0.1:47823` (daemon not running yet).

---

## Stage 4 — Start the daemon + connect (5 min)

`wolf serve` **is the daemon (HTTP server only)**. The companion side
panel talks to it over `http://127.0.0.1:<port>`; without it running,
every action the companion tries is rejected.

> **Note: the daemon does NOT start the wolf Chrome.** `wolf serve`
> launches the HTTP server only; the wolf Chrome window is started
> lazily by clicking **Open wolf browser** in Stage 5, which triggers
> `POST /api/browser/open`. This is intentional — the daemon stays
> light, and you can connect from the side panel before Chrome is
> needed (e.g., to check status). The runtime overlay tells you to
> click the button when Chrome is required.

Run everything **in real foreground terminal windows** (two visible
sessions, **terminal A** and **terminal B**). Do not `&`-background
serve, do not use `nohup`, do not use `tmux detach`. Keeping the
processes attached to a real terminal is what lets you read the
heartbeat logs, kill the daemon with Ctrl-C cleanly, and observe
errors in real time.

This stage uses a **throwaway workspace under `/tmp/wolf-test/`** so the
wolf browser profile created in Stage 5 lands at
`/tmp/wolf-test/manual-companion-<id>/ws/data/wolf-browser-profile/`
instead of polluting your real workspace. Aligns with the CLAUDE.md
rule that smoke + acceptance tests must only use `/tmp/wolf-test/`
paths.

### 4a — Build the dev binary (once per session)

In **terminal A**:

```bash
cd /Users/guanyutao/developers/personal-projects/wolf
npm run build:dev   # produces dist/cli/index.js for the dev workspace
```

### 4b — Init throwaway workspace (once)

In **terminal B** (keep this one open for serve):

```bash
# Throwaway workspace path; same value reused for init + serve.
export WOLF_DEV_HOME="/tmp/wolf-test/manual-companion-$(date +%Y%m%d-%H%M%S)/ws"
mkdir -p "$WOLF_DEV_HOME"

# One-time init for the throwaway workspace (no prompts).
node dist/cli/index.js init --here --empty --dev
```

### 4c — Start the daemon (foreground, keep running)

Still in terminal B (foreground, attached to your real terminal —
**no `&`, no `nohup`, no detach**):

```bash
node dist/cli/index.js serve --port 47823
```

Wait for `wolf serve listening on http://127.0.0.1:47823`. **Do not
close this terminal** until you finish Stage 7 — the side panel needs
the daemon alive for every action. The wolf browser profile will be
created under `$WOLF_DEV_HOME/data/wolf-browser-profile/` only when
you click **Open wolf browser** in Stage 5; right now `data/` is still
empty.

### 4d — Reconnect from the side panel

Back in side panel:

1. Click ConnectionPill → popover slides out
2. Confirm port = 47823, click **Reconnect**
3. Pill cycles idle (yellow) → connected (green dot + `:47823`)
4. Activity log: "Connected: wolf <version>"
5. Hero switches to "STEP 1 OF 4 / Open wolf browser" with body
   explaining the **separate Chrome profile** rationale (this is the
   Q1 honest copy — verify it reads right)

**Pass:** Pill turns green, Hero advances, Activity log records the
transition. Terminal B keeps logging GET /api/runtime/status every 5s
(heartbeat) — that's expected.

> **Cleanup after the whole run:** `rm -rf /tmp/wolf-test/manual-companion-*`
> wipes the workspace + the wolf browser profile in one shot. Your real
> `~/wolf/` (or wherever your stable workspace lives) is never touched.

---

## Stage 5 — Open wolf browser (3 min)

1. Click **Open wolf browser** (in Hero or pill popover)
2. Terminal: `POST /api/browser/open`
3. New Chrome window pops up (independent profile, blank/about:blank)
4. Side panel:
   - [ ] runtimeOverlay disappears
   - [ ] Hero shifts to "STEP 2 OF 4 / Import a job posting"
   - [ ] ProgressStrip segment 1 turns blue (active)

**Verify profile isolation:**
- New Chrome window's `chrome://version` → **Profile Path** ends in
  `/tmp/wolf-test/manual-companion-<timestamp>/ws/data/wolf-browser-profile/...`
  (matching `$WOLF_DEV_HOME` from Stage 4b)
- Daily Chrome's cookies/history are unchanged

**Pass:** Two Chrome processes coexist; daily browser is untouched.

---

## Stage 6 — Import → Process → Tailor (10 min, paid)

In the wolf window, open a real job posting (recommend `jobs.lever.co/...` or `boards.greenhouse.io/...` — avoid LinkedIn since login may interfere).

1. **Import** (free): side panel → **Import this page**
   - Activity log: "Imported page to wolf inbox: <id>"
   - Hero advances to "STEP 3 OF 4 / 1 imported page ready"
2. **Process** (paid Claude API call): click **Process Inbox (1)** → confirm
   - 5s later Hero shows "wolf is working" + Check run
   - On completion Hero advances to "STEP 4 OF 4 / X jobs ready to tailor"
3. **Tailor** (paid): click **Batch Tailor (X)**
   - Hero advances to "All caught up / Resume + cover letter ready"
   - Resume + Cover Letter buttons turn green

**Pass:** Each phase's Hero text matches and Activity log records the transitions. Skip steps 2-3 if you want to avoid AI cost; minimum here is step 1.

---

## Stage 7 — Settings + Edit modal (3 min)

1. Click ⚙️ gear → Settings panel renders
2. Edit any field (e.g. Hunt minScore 0.5 → 0.6) → **Save Config**
   - Terminal: `POST /api/config`
   - `wolf.toml` written
3. **Back** → main view

If Resume is ready (after Stage 6):

4. Click **Resume** → preview opens in a new wolf-browser tab
5. Side panel switches to artifact-edit view
6. Type instructions in textarea → **Regenerate Resume** (paid, optional)
7. **Back** → main view; textarea cleared

**Pass:** Modal in/out clean, form persists, no crashes.

---

## Stage 8 — Resize (2 min)

Drag the side panel left edge through three widths:

- [ ] **~280–320 px (narrow):** TopBar doesn't overflow, Hero/Roadmap wrap, queue scrolls horizontally
- [ ] **~400 px (default):** baseline
- [ ] **~560 px (wide):** content fills, no horizontal scrollbar

**Pass:** All three widths render without breaking.

---

## Stage 9 — Reduce-motion (1 min, macOS only)

1. System Settings → Accessibility → Display → enable **Reduce motion**
2. Close + reopen side panel (or reload extension)
3. WelcomeCard appears instantly (no spring); Hero phase transitions are instant
4. **Disable Reduce motion** when done

**Pass:** Animations collapse to instant under reduced-motion preference.

---

## Stage 10 — Visual review harness (5 min)

```bash
cd extension
npm run review
```

Output:

```
[harness] 24 screenshots → .../snapshots/current
[harness] report → .../report.md
```

Open `extension/test/visual/snapshots/current/` and spot-check the
default-width PNG for each named state:

- [ ] `first-run--default.png` — WelcomeCard centered, blue Got it
- [ ] `disconnected--default.png` — no welcome, hero "Connect to wolf serve"
- [ ] `connected-empty--default.png` — hero "Import a job posting"
- [ ] `has-imports--default.png` — blue Process Inbox CTA
- [ ] `has-processed--default.png` — hero "X jobs ready to tailor"
- [ ] `has-tailored--default.png` — hero "All caught up"
- [ ] `runtime-not-ready--default.png` — yellow runtimeOverlay
- [ ] `config-open--default.png` — Settings form rendered

Glance through the narrow (320) and wide (560) variants for layout
breaks.

---

## Failure report template

If a stage fails, capture:

```
Stage: N
Failed step: <description>
Expected: <what should have happened>
Actual: <what happened>
DevTools console error: <paste if any>
Terminal stderr: <paste if any>
Screenshot: <path or attach>
```

Send the block back instead of trying to debug inline.

---

## After full pass

```bash
# Optional: seed the baseline so future review runs can diff against it.
mkdir -p extension/test/visual/snapshots/baseline
cp extension/test/visual/snapshots/current/*.png extension/test/visual/snapshots/baseline/
git add extension/test/visual/snapshots/baseline
git commit -m "test(extension): seed visual review baseline (S7 follow-up)"

# Push + PR
git push -u origin companion-redesign
gh pr create --title "Companion redesign: React + Vite + Apple style" --body "<see plan>"
```

Minimum-required stages for a green review: **0, 1, 2, 3, 8, 10**
(no AI cost). Stages 4-7 and 9 are recommended but non-blocking.
