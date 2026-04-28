# Errors Layer

Typed custom error classes. Every error thrown by wolf is an instance of a documented type.

## Why

Plain `throw new Error("...")` forces callers to string-match error messages, which breaks silently. Typed errors let the CLI handle different failure modes differently:

```typescript
try {
  await app.tailor(jobId);
} catch (err) {
  if (err instanceof JobNotFoundError) { /* show "no such job" message */ }
  else if (err instanceof AiCallFailedError) { /* show API retry hint */ }
  else if (err instanceof RenderFailedError) { /* show xelatex/playwright diagnostics */ }
  else { throw err; }
}
```

## Naming convention

- `<Thing><Verb>Error` — e.g. `JobNotFoundError`, `RenderFailedError`, `AiCallFailedError`
- Each class extends `Error` and sets `this.name = '<ClassName>'`
- Include relevant context in the constructor, e.g. `new JobNotFoundError(jobId)`

## Planned error types (add as needed)

- `JobNotFoundError(jobId: string)`
- `ProfileNotFoundError(profileId: string)`
- `AiCallFailedError(cause: Error, request: string)`
- `RenderFailedError(cause: Error, stage: 'compile' | 'pageCount')`
- `DataPersistenceError(cause: Error, operation: string)`
- `InvalidInputError(field: string, value: unknown)`

## Layer rules

- Errors are thrown **from the layer that detects them** (repository, service, or application)
- CLI catches and formats; other layers re-throw unchanged
- Never swallow an error and return `null` — that hides failure modes
