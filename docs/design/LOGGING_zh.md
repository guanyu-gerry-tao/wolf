# 日志使用指南 — wolf

如何用好 `AppContext.logger`。logger 的存在意义是：让我们能在 tailor / hunt / fill 流程跑完之后、不用重新复现就能回头排查。糟糕的日志会淹没信号，好的日志才会把信号浮出来。

实现见 [`src/utils/logger.ts`](../../src/utils/logger.ts)；我们为什么选择 JSONL + stderr 而不是 SQLite 日志表，见 [`DECISIONS_zh.md`](./DECISIONS_zh.md)。

## 核心原则

> **记录"状态跃迁"和"边界穿越"。不要记录"函数被调用了"。**

**该记录：**
- **I/O 边界** —— 每一次 AI 调用、重要的 DB 查询、子进程启动、可能失败的文件读写
- **状态跃迁** —— "job 已打分"、"tailor analyze 完成"、"batch 已提交"、"batch 已返回"
- **错误和重试** —— 任何被 catch 的、被重试的、最终失败兜底的
- **成本信号** —— AI token 数、batch 大小、长耗时操作的 duration

**不该记录：**
- 纯逻辑函数的进入 / 退出 —— 噪音，不是信号
- 每一次变量赋值 —— 那是 debugger 的事
- 看代码就能知道的事情 —— 比如没有字段的 "validated input"
- 面向用户的交互输出（prompt、菜单、表格）—— 这些走 `console.log` 到 stdout，**不要**走 logger

## 日志级别

四级，使用方式如下：

| 级别 | 用途 | 示例 |
|---|---|---|
| `debug` | 仅开发用，`WOLF_LOG=debug` 才显示 | 完整 AI 请求 / 响应体、SQL 查询文本、正在读的文件路径 |
| `info` | 操作者应当看到的正常进度 | "Tailoring resume for job abc123"、"42 jobs hunted"、"Batch submitted (id=bat_xyz, jobs=50)" |
| `warn` | 可恢复的异常，值得标记 | "Anthropic 429, retrying (2/3)"、"hint.md missing, proceeding without"、"Fit loop hit margin cap, falling back to linespread" |
| `error` | 操作失败 | "xelatex exit 1"、"jobId not found in DB"、"Invalid profile config" —— 除非调用方重抛，否则流程继续 |

级别代表**声音大小**，不代表**发生了什么**。"什么"由结构化字段携带。

没有 `fatal`。"进程必须退出"是调用方的决定（`logger.error(...); process.exit(1)`），不是日志级别的属性。

## 调用形态

```ts
logger.info('message', { field1, field2 });
```

- **Message** 是短的、静态的、人类可读字符串。**不要**把动态值拼进去——动态值全部放字段里。
- **Fields** 是任何相关数据：`jobId`、`profileId`、`durationMs`、`tokensIn`、`tokensOut`、`attempt`、`exit`、`path`。

**好例子：**
```ts
logger.info('Tailor analyze complete', { jobId, durationMs, tokensOut });
logger.warn('Anthropic rate-limited, retrying', { attempt, delayMs });
logger.error('xelatex exit non-zero', { exit, jobId, logPath });
```

**反例：**
```ts
logger.info(`Tailored ${jobId} in ${durationMs}ms`);  // 非结构化，没法查
logger.debug('entering fitToOnePage');                 // 噪音
logger.info('Starting loop');                          // 没上下文没字段
```

静态 message + 结构化字段意味着 `jq 'select(.msg=="Tailor analyze complete") | .durationMs'` 永远能工作。插值字符串不行。

## 日志去哪

- **控制台** → stderr，默认 pretty 格式（想要 JSON on stderr：`WOLF_LOG_FORMAT=json`）
- **文件** → `data/logs/wolf.log.jsonl`，始终 JSON，一事件一行
- **stdout 是保留的**——留给命令的实际产出（表格、JSON 返回、MCP 协议帧）。**永远不要**把日志写到 stdout。

运行时控制：

```bash
WOLF_LOG=debug wolf tailor full --jobId abc123
WOLF_LOG_FORMAT=json wolf hunt | jq .
tail -f data/logs/wolf.log.jsonl | jq 'select(.level=="error")'
```

## 代码里怎么用

从 `AppContext` 拿 logger：

```ts
// Command handler
export async function someCommand(options: Options, ctx: AppContext = createAppContext()) {
  ctx.logger.info('Starting something', { /* fields */ });
  // ...
}
```

对于需要在实现内部打日志的 service，通过构造函数注入 logger —— 和 repository 的注入方式一致：

```ts
export class MyServiceImpl implements MyService {
  constructor(private logger: Logger, /* other deps */) {}

  async doWork() {
    this.logger.debug('Work starting');
    // ...
  }
}
```

依赖在 `src/cli/appContext.ts` 里组装（和 repository 一样的位置）。

测试中用 `src/utils/logger.ts` 里的 `createSilentLogger()` 或 `createMemorySink()`。`createTestAppContext()` 已经默认给了 silent logger。

## 何时对现有代码做补日志

**不要**批量注入日志。以下情况才加：

1. 在写新代码 —— 边写边加
2. 在排查真实问题 —— 加一条日志、修好 bug、如果以后还能帮上忙就留着
3. 在做 backlog 上明确的 "给 X 加日志" issue

优先改造目标（都适合做 first issue）：

- `src/service/impl/resumeCoverLetterServiceImpl.ts` —— 给 AI 调用包上 `durationMs`、`tokensIn`、`tokensOut`、重试次数
- `src/service/impl/tailoringBriefServiceImpl.ts` —— 同上
- `src/service/impl/renderServiceImpl.ts` —— 给 xelatex / playwright 子进程包上 `exit`、`durationMs`、fit-loop 状态跃迁
- `src/service/impl/batchServiceImpl.ts` —— batch 生命周期日志（提交、轮询、返回、失败）
- 任何当前只是裸 `throw`、没有上下文的地方

## 小贴士

- **静态 message 让你能做查询。**按 `msg` 分组统计"X 发生了多少次"——只有 message 字符串稳定才有意义。
- **字段白送不要钱。**该加就加。将来 `jq` 查 `.jobId == "abc123"` 能不能工作，取决于相关事件里有没有 `jobId` 字段。
- **不要日志敏感信息。**API key、JWT 原文、完整简历、PII。文件 sink 会落盘。
- **Warn ≠ error。**重试成功了就是 warn，不是 error。只有不可恢复的失败才叫 error。
