# Service Layer (Domain Services)

Single-responsibility business operations. Each service does one thing well.

## Responsibilities

- Call external tools (Playwright, Anthropic SDK, subprocesses)
- Wrap SDKs with typed inputs and outputs
- Throw typed errors on failure (from `src/errors/`)
- Return data; do not persist

## NOT responsibilities

- Multi-step orchestration (that's `src/application/`)
- Reading from / writing to storage (that's `src/repository/`)
- Knowing about CLI options (that's `src/cli/` + `src/commands/`)

## Interface + impl/ pattern

```
service/
├── rewrite.ts               # interface RewriteService
├── render.ts                # interface RenderService
├── scoring.ts               # interface ScoringService
├── impl/
│   ├── claudeRewriteService.ts      # real — calls Anthropic SDK
│   ├── mockRewriteService.ts        # mock — returns deterministic placeholder
│   ├── playwrightRenderService.ts   # real — uses Playwright
│   ├── claudeScoringService.ts
│   └── mockScoringService.ts
└── model/
    ├── renderParams.ts              # DTOs returned / consumed by services
    └── scoreResult.ts
```

## Mocks are first-class production code

Mock implementations (`mockRewriteService.ts`, `mockScoringService.ts`) live here **alongside** the real implementations. They are:

- The **default** choice when API keys are missing (AppContext decides)
- Used in unit tests of higher layers (application, CLI)
- Completely self-contained — no network, no subprocess, deterministic output

This lets wolf run end-to-end without any API key: clone → `npm install` → `wolf --help` → works. AI features return clearly-labeled placeholder output so the user knows what's going on.

## Extension pattern: adding a new service

1. Define the interface in `src/service/<name>.ts`
2. Add `src/service/impl/real<Name>Service.ts` for the real implementation
3. Add `src/service/impl/mock<Name>Service.ts` for the mock
4. Register both in `src/cli/appContext.ts`
5. Consumers (application services, CLI) import only the interface

## Example

```typescript
// src/service/rewrite.ts
export interface RewriteService {
  rewriteBullets(resumePool: string, jdText: string, notes: string): Promise<string>;
}

// src/service/impl/claudeRewriteService.ts
import type { RewriteService } from '../rewrite.js';
export class ClaudeRewriteService implements RewriteService {
  constructor(private apiKey: string) {}
  async rewriteBullets(resumePool: string, jdText: string, notes: string): Promise<string> {
    // real Anthropic SDK call
  }
}

// src/service/impl/mockRewriteService.ts
import type { RewriteService } from '../rewrite.js';
export class MockRewriteService implements RewriteService {
  async rewriteBullets(_: string, __: string, ___: string): Promise<string> {
    return '[mock rewrite — set WOLF_ANTHROPIC_API_KEY for real output]';
  }
}
```

## Testing

- Services that wrap external tools: unit tests mock at the wrapper boundary (e.g., mock `child_process.spawnSync` for the render service)
- Integration tests live in `src/__integration__/` and exercise the real tool
