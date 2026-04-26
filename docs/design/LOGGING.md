# Logging Guide — wolf

How to use `AppContext.logger` well. The logger exists so we can debug the tailor/hunt/fill pipelines after the fact without re-running them. Bad logging hides signal; good logging surfaces it.

See [`src/utils/logger.ts`](../../src/utils/logger.ts) for the implementation and [`DECISIONS.md`](./DECISIONS.md) for why we chose JSONL + stderr over a SQLite log table.

## The principle

> **Log state transitions and boundary crossings. Not function calls.**

Do log:
- **I/O boundaries** — every AI call, DB query that matters, subprocess spawn, file read/write that can fail
- **State transitions** — "job scored", "tailor analyze done", "batch submitted", "batch resolved"
- **Errors and retries** — anything we catch, anything we retry, anything that falls through
- **Cost signals** — AI token counts, batch sizes, durations of long operations

Don't log:
- Function entry/exit in pure logic — noise, not signal
- Every variable assignment — that's what a debugger is for
- Things that are already obvious from the code — "validated input" without fields
- User-facing interactive output (prompts, menus, tables) — that belongs on stdout via `console.log`, not through the logger

## Levels

Four levels, used as follows:

| Level | Use | Examples |
|---|---|---|
| `debug` | Dev-only. Hidden unless `WOLF_LOG=debug` | Full AI request/response bodies, SQL query text, file paths being read |
| `info` | Normal progress the operator should see | "Tailoring resume for job abc123", "42 jobs hunted", "Batch submitted (id=bat_xyz, jobs=50)" |
| `warn` | Recoverable anomaly, worth flagging | "Anthropic 429, retrying (2/3)", "hint.md missing, proceeding without", "Fit loop hit margin cap, falling back to linespread" |
| `error` | Operation failed | "xelatex exit 1", "jobId not found in DB", "Invalid profile config" — continues unless caller rethrows |

Level = how loud, not what happened. The *what* goes in the structured fields.

There is no `fatal` — "the process must die" is a caller decision (`logger.error(...); process.exit(1)`), not a log level.

## Call shape

```ts
logger.info('message', { field1, field2 });
```

- **Message** is a short, static, human string. No interpolation of dynamic values — put those in fields instead.
- **Fields** are anything relevant: `jobId`, `profileId`, `durationMs`, `tokensIn`, `tokensOut`, `attempt`, `exit`, `path`.

**Good:**
```ts
logger.info('Tailor analyze complete', { jobId, durationMs, tokensOut });
logger.warn('Anthropic rate-limited, retrying', { attempt, delayMs });
logger.error('xelatex exit non-zero', { exit, jobId, logPath });
```

**Bad:**
```ts
logger.info(`Tailored ${jobId} in ${durationMs}ms`);  // unstructured, unqueryable
logger.debug('entering fitToOnePage');                 // noise
logger.info('Starting loop');                          // no context, no fields
```

A static message plus structured fields means `jq 'select(.msg=="Tailor analyze complete") | .durationMs'` works forever. Interpolated strings don't.

## Where it goes

- **Console** → stderr, pretty format by default (`WOLF_LOG_FORMAT=json` for JSON on stderr)
- **File** → `data/logs/wolf.log.jsonl`, always JSON, one event per line
- Stdout is **reserved** for command deliverables (tables, JSON payloads, MCP protocol frames). Never send log output to stdout.

Control at runtime:

```bash
WOLF_LOG=debug wolf tailor full --jobId abc123
WOLF_LOG_FORMAT=json wolf hunt | jq .
tail -f data/logs/wolf.log.jsonl | jq 'select(.level=="error")'
```

## How to use in code

Get the logger from `AppContext`:

```ts
// Command handler
export async function someCommand(options: Options, ctx: AppContext = createAppContext()) {
  ctx.logger.info('Starting something', { /* fields */ });
  // ...
}
```

For services that need to log from inside their implementation, inject the logger via constructor — matching how repositories are injected:

```ts
export class MyServiceImpl implements MyService {
  constructor(private logger: Logger, /* other deps */) {}

  async doWork() {
    this.logger.debug('Work starting');
    // ...
  }
}
```

Wire the dependency in `src/cli/appContext.ts` (same place you wire repositories).

In tests, use `createSilentLogger()` or `createMemorySink()` from `src/utils/logger.ts`. `createTestAppContext()` already provides a silent logger.

## When to instrument existing code

We do NOT blanket-instrument. Add logging when:

1. You're writing new code → log while you write
2. You're debugging a real issue → add log, fix, keep the log if it'll help next time
3. You're specifically working on a "add logging to X" issue from the backlog

Priority retrofit targets (each is a good first issue):

- `src/service/impl/resumeCoverLetterServiceImpl.ts` — wrap AI calls with `durationMs`, `tokensIn`, `tokensOut`, retry counts
- `src/service/impl/tailoringBriefServiceImpl.ts` — same
- `src/service/impl/renderServiceImpl.ts` — wrap xelatex/playwright subprocess calls with `exit`, `durationMs`, fit-loop state transitions
- `src/service/impl/batchServiceImpl.ts` — log batch lifecycle (submitted, polling, resolved, failed)
- Anywhere we currently `throw` without context

## Tips

- **Static messages enable queries.** Grouping events by `msg` tells you "how often did X happen?" — only works if the message string is stable.
- **Fields are free.** Add them liberally. A future `jq` query for `.jobId == "abc123"` only works if every relevant event includes `jobId`.
- **Don't log secrets.** API keys, raw JWT payloads, full resumes, PII. The file sink persists to disk.
- **Warn ≠ error.** If you retry and it succeeds, it was a warn, not an error. Only unrecoverable failure is an error.
