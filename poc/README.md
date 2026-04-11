# POC — Proof of Concept experiments

Self-contained minimal scripts that validate specific technical approaches
before production code lands under `src/`.

## What belongs here

- Single-question feasibility experiments
- Throwaway / reference code — doesn't need to follow production conventions
- Frozen reference implementations after an experiment concludes

## What does NOT belong here

- Production code — goes under `src/`
- Unit / integration tests — colocated with the code they test
- One-off maintenance scripts — would go under `scripts/` if added later

## Layout

Each POC is its own subfolder with:
- `README.md` — the question it answers, run command, and results
- The minimal code / HTML / data to run the experiment
- An optional `output/` (gitignored) for generated artifacts
- An optional local `tsconfig.json` extending the root, so the POC gets
  type-checked without being compiled into the main `dist/`

## Current POCs

| Folder | What it validates | Status |
|---|---|---|
| `filling/` | Auto form-fill pipeline (Browser MCP + Playwriter) | Frozen reference. Some scripts require `playwright-core` + `playwriter` to re-run — not in main deps; install manually if you need to reproduce. |
| `html-rendering/` | HTML + CSS + Playwright as a resume → PDF renderer | Active — Phase 2 spike of the layered-refactor plan |

## Adding a new POC

1. Create `poc/<short-name>/`
2. Add a `README.md` stating the question, run command, expected result
3. Add a local `tsconfig.json` if the POC uses TypeScript
4. Keep it minimal — POCs answer one question, not produce a product
