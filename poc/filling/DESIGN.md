# wolf fill — POC Design

See [DESIGN_zh.md](DESIGN_zh.md) for the full design document (Chinese).

## Quick summary

Browser automation pipeline for job application form filling using Playwriter (real Chrome) + Claude (one inference) + Playwright (execution).

```
Playwriter relay → connectOverCDP → page.evaluate() → Claude → Playwright fill
```
