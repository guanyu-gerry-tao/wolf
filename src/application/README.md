# Application Service Layer

Use-case orchestration. Each application service composes multiple domain services into a complete user-facing operation.

## Naming: "Application Service" (DDD-standard)

In DDD / hexagonal architecture, "application service" is the name for the use-case layer that sits between the UI (CLI) and the domain (services). It orchestrates but contains no business logic of its own.

Other names for the same concept: "use case", "interactor", "workflow", "facade". wolf uses "application service" because it's the most industry-standard.

## Responsibilities

- Compose domain service calls into a full operation
- Implement retry / binary search / recovery logic across multiple steps
- Load / save via the repository layer as needed
- Return a typed result to the CLI

## NOT responsibilities

- Direct subprocess or network calls (delegate to domain services)
- Knowing about CLI flags or error formatting (that's CLI)
- Containing business rules that belong in a domain service

## Interface + impl/ pattern

```
application/
├── tailor.ts                # interface TailorApplicationService
├── hunt.ts                  # interface HuntApplicationService
├── score.ts                 # interface ScoreApplicationService
├── impl/
│   ├── tailorApplicationService.ts   # the tailor pipeline: rewrite → render → fitToOnePage → save
│   ├── huntApplicationService.ts
│   └── scoreApplicationService.ts
└── model/
    ├── tailorResult.ts               # DTOs
    └── huntResult.ts
```

## Extension pattern: adding a new use case

1. Define interface in `src/application/<name>.ts`
2. Implement in `src/application/impl/<name>ApplicationService.ts`
3. Inject domain services + repositories via constructor
4. Register in `src/runtime/appContext.ts`
5. CLI wrapper (`src/cli/commands/<name>.ts`) calls through to it

## Example

```typescript
// src/application/tailor.ts
import type { TailorResult } from './model/tailorResult.js';

export interface TailorApplicationService {
  runPipeline(jobId: string, profileId: string): Promise<TailorResult>;
}

// src/application/impl/tailorApplicationService.ts
export class TailorApplicationServiceImpl implements TailorApplicationService {
  constructor(
    private jobRepo: JobRepository,
    private profileRepo: ProfileRepository,
    private rewriteService: RewriteService,
    private renderService: RenderService,
  ) {}

  async runPipeline(jobId: string, profileId: string): Promise<TailorResult> {
    const job = await this.jobRepo.get(jobId);
    const profile = await this.profileRepo.get(profileId);
    const jdText = await this.jobRepo.readJdText(jobId);
    const rewritten = await this.rewriteService.rewriteBullets(profile.resumePool, jdText, profile.scoringNotes);
    const pdfPath = await this.fitToOnePage(rewritten);
    await this.jobRepo.update(jobId, { tailoredResumePdfPath: pdfPath });
    return { pdfPath, matchScore: /* ... */ };
  }

  private async fitToOnePage(html: string): Promise<string> { /* binary search */ }
}
```

## Testing

- Unit tests inject mock domain services and in-memory repositories — no real I/O
- The application service IS the unit under test; everything below it is stubbed
