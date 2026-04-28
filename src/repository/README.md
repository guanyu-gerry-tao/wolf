# Repository Layer

Data access layer. The only layer that knows about the workspace file structure and SQLite schema.

## Responsibilities

- Read and write job / company / profile data in SQLite
- Read and write files in the workspace (`profile.md`, `resume_pool.md`, `standard_questions.md`, `attachments/`, etc.)
- Convert between stored representation and domain types
- Hide storage details from service, application, and CLI layers

## NOT responsibilities

- Business logic (that's service / application)
- Parsing user input (that's CLI)
- External API calls like Claude (that's service)

## Interface + impl/ pattern

Interface definitions live at the top of this folder. Concrete implementations live under `impl/`.

```
repository/
├── job.ts               # interface JobRepository
├── company.ts           # interface CompanyRepository
├── profile.ts           # interface ProfileRepository
└── impl/
    ├── sqliteJobRepository.ts     # SQLite backing
    ├── sqliteCompanyRepository.ts
    └── fileProfileRepository.ts   # Markdown files + attachments/ on disk
```

Callers import the interface, AppContext constructs the implementation. Swap storage backends without touching anything but `impl/` + `appContext.ts`.

## Extension pattern: adding a new storage backend

1. Create new file under `src/repository/impl/<name>.ts`
2. Implement the same interface as the existing impl
3. Edit `src/cli/appContext.ts` to construct the new impl instead
4. No other files change

## Example interface

```typescript
// src/repository/job.ts
import type { Job, JobQuery, JobUpdate } from '../types/index.js';

export interface JobRepository {
  get(id: string): Promise<Job | null>;
  save(job: Job): Promise<void>;
  query(q: JobQuery): Promise<Job[]>;
  update(id: string, patch: JobUpdate): Promise<void>;
}
```

## Testing

- Unit tests use `InMemoryJobRepository` (another impl under `impl/`) — no real DB needed
- Integration tests use the real `SqliteJobRepository` against a temp DB file
