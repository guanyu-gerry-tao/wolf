# wolf POC — Browser MCP form-filling

Proof-of-concept for Milestone 4 (`wolf fill`).

## What this tests

That the two-phase architecture works end-to-end:

1. **Snapshot** — one Browser MCP call to get the accessibility tree of the page
2. **Analyze** — one Claude API call maps form fields to profile data (AI reads, never executes)
3. **Execute** — wolf program loops through the mapping and calls `browser_type` / `browser_click` directly (no AI round-trips)

## Prerequisites

1. Chrome with the **Browser MCP extension** installed
   → https://chromewebstore.google.com/detail/browser-mcp-automate-your/bjfgambnhccakkhmkepdoekmckoijdlc

2. `WOLF_ANTHROPIC_API_KEY` set in your shell

3. `tsx` available (one-off install):
   ```bash
   npm install -g tsx
   ```

## Run

```bash
# Greenhouse (no login needed — good first test)
npx tsx poc/fill-browsermcp.ts https://boards.greenhouse.io/anthropic/jobs/

# Or any other job application URL
npx tsx poc/fill-browsermcp.ts <url>
```

Browser MCP server starts automatically via `npx @browsermcp/mcp@latest`.

## What to observe

- A Chrome window opens and navigates to the URL
- The terminal prints the proposed field mapping (dry-run)
- After you confirm with `y`, the program fills the fields — no further AI calls
- A screenshot is taken at the end

## Known limitations (POC scope)

| Limitation | Plan for production |
|---|---|
| File upload (`resume`) | Browser MCP has no upload tool yet → fallback to Playwright `setInputFiles()` |
| Multi-page forms | Re-run snapshot + analyze on each page |
| CAPTCHA | Pause and let user handle manually |
| Profile is hardcoded | Wire to `wolf.toml` + SQLite in M4 |
