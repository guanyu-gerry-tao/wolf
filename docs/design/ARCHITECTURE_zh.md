# 架构 — wolf

## 概览

wolf 是一个多入口应用：既可以作为 **CLI 工具**（供人类用户使用），也可以作为 **MCP 服务器**（供 AI agent 如 OpenClaw 使用），还可以作为本地 **HTTP daemon**（`wolf serve`）供浏览器 companion extension 调用。所有入口共享同一套 application service，无论如何调用，行为保持一致。

```
        人类（终端）                 AI Agent（OpenClaw）        浏览器扩展
               │                          │
               v                          v
        ┌─────────────┐          ┌────────────────┐          ┌──────────────┐
        │   CLI 层    │          │    MCP 层      │          │  HTTP 层     │   表现层
        │ commander.js│          │   MCP SDK      │          │ wolf serve   │
        └──────┬──────┘          └───────┬────────┘          └──────┬───────┘
               └────────────┬────────────┴────────────┬────────────┘
                            │                         │
                            v                         v
               ┌────────────────────────┐
               │        命令层          │   Commands
               │  tailor / hunt / score │
               │  fill / reach / ...    │
               └────────────┬───────────┘
                            │
                            v
               ┌────────────────────────┐
               │        流程层          │   Workflows
               │  tailor 流水线         │
               │  fitToOnePage          │
               │  score 流水线          │
               └────────────┬───────────┘
                            │
                            v
               ┌────────────────────────┐
               │        服务层          │   Services
               │  compile / rewrite     │
               │  scoring / email       │
               └────────────┬───────────┘
                            │
                            v
        ┌──────────┬─────────────┬────────────┬─────────┐
        │  Claude  │   SQLite    │ Playwright │  Gmail  │   工具层 + 外部服务
        │   API    │             │ (Chromium) │   API   │
        └──────────┴─────────────┴────────────┴─────────┘
```

## 分层架构

wolf 分为五层，每层只能依赖其下方的层——不允许横向或向上依赖。

```
┌──────────────────────────────────────────────────────┐
│  表现层  src/cli/  src/mcp/  src/serve/                │
│  解析参数 / 协议、格式化输出。CLI 和 HTTP wrapper       │
│  都委托给 application service。                         │
├──────────────────────────────────────────────────────┤
│  应用层  src/application/                             │
│  用例编排。多步骤流水线。                               │
│  每个命令——哪怕只有三行——都走这一层。                  │
├──────────────────────────────────────────────────────┤
│  服务层  src/service/                                 │
│  单一职责领域操作。AI 调用、外部 API、渲染。             │
├──────────────────────────────────────────────────────┤
│  仓储层  src/repository/                              │
│  数据访问——SQLite（Drizzle）+ 工作区文件。              │
│  每个实体一个接口；impl/ 放具体实现。                   │
├──────────────────────────────────────────────────────┤
│  Utils  src/utils/                                   │
│  横切辅助、types/、errors/。不是依赖意义上的一层——     │
│  任何层都可 import。                                   │
└──────────────────────────────────────────────────────┘

AppContext（src/runtime/appContext.ts）— 手动 DI 容器，CLI、MCP、serve HTTP 共用。
```

**层依赖方向：** `cli / mcp / serve → application → service → repository → utils`

### 各层职责

| 层 | 目录 | 负责 | 不负责 |
|---|---|---|---|
| **Utils** | `src/utils/`（含 `types/`、`errors/`） | 横切辅助（logger、config、env、parseModelRef）；共享领域类型；类型化错误类 | 命令逻辑或保存状态 |
| **仓储层** | `src/repository/` | 读写 SQLite（通过 Drizzle）和工作区文件（`profile.toml`、`score.md`、prompt strategy 文件、`attachments/`） | 业务逻辑或调用其他层 |
| **服务层** | `src/service/`（含 `service/ai/`） | 单一职责操作（AI provider 注册表 + 客户端、外部 API 抓取、渲染、批次提交） | 编排多步骤流程或直接访问 DB |
| **应用层** | `src/application/` | 编排每个用例——包括 config get/set、env list 这类一行命令。拥有 init 模板。 | 感知 CLI 参数、MCP schema 或终端格式化 |
| **表现层** | `src/cli/`（`index.ts` + `commands/<verb>.ts`）、`src/mcp/`、`src/serve/` | 解析输入 / 协议、格式化输出、承载 inquirer 提示、暴露本地 HTTP route | 参数映射、协议映射和格式化以外的任何逻辑 |

### 依赖注入——AppContext

所有具体实现都在 `src/runtime/appContext.ts` 中构建。`src/cli/`、`src/mcp/` 和 `src/serve/` 共用同一个 `AppContext`。其他任何地方都不直接实例化 repository 或 service。这是唯一的替换点：将真实实现换成 mock，只需修改 `appContext.ts`，其他文件一概不变。

```typescript
// src/runtime/appContext.ts
export interface AppContext {
  // repositories
  jobRepository: JobRepository;
  companyRepository: CompanyRepository;
  batchRepository: BatchRepository;
  backgroundAiBatchRepository: BackgroundAiBatchRepository;
  inboxRepository: InboxRepository;
  profileRepository: ProfileRepository;
  // services
  batchService: BatchService;
  httpServer: HttpServer;
  // ...renderService、rewriteService、briefService、fillService 等
  // 应用服务（每个 CLI verb 一个）
  addApp: AddApplicationService;
  configApp: ConfigApplicationService;
  doctorApp: DoctorApplicationService;
  envApp: EnvApplicationService;
  fillApp: FillApplicationService;
  huntApp: HuntApplicationService;
  initApp: InitApplicationService;
  jobApp: JobApplicationService;
  profileApp: ProfileApplicationService;
  reachApp: ReachApplicationService;
  scoreApp: ScoreApplicationService;
  statusApp: StatusApplicationService;
  tailorApp: TailorApplicationService;
  inboxApp: InboxApplicationService;
  inboxPromotionApp: InboxPromotionApplicationService;
  backgroundAiBatchWorker: BackgroundAiBatchWorker;
  serveApp: ServeApplicationService;
}
```

### Dev 和 stable 实例

wolf 有两个 build mode，避免开发和验收测试误伤真实 dogfood 数据。

| Mode | Build | 调用方式 | 默认 workspace | 环境变量命名空间 | MCP tools |
|---|---|---|---|---|---|
| stable | `npm run build` | `wolf ...` | `~/wolf` 或 `WOLF_HOME` | `WOLF_*` | `wolf_*` |
| dev | `npm run build:dev` | `npm run wolf -- ...` | `~/wolf-dev` 或 `WOLF_DEV_HOME` | `WOLF_DEV_*`，fallback 到 `WOLF_*` | `wolfdev_*` |

`src/utils/instance.ts` 是 build mode、workspace 解析、环境变量读取和 dev warning 的唯一真相来源。验收测试必须每次命令都设置 `WOLF_DEV_HOME=/tmp/wolf-test/<suite>/<run-id>/workspaces/<workspace-id>`，并且只能在 `/tmp/wolf-test/` 下创建/删除路径。

### 目录结构

```
src/
├── cli/                                # 表现层 — commander.js
│   ├── index.ts                            # CLI 入口；注册所有子命令
│   └── commands/                           # 每个 verb 一个文件（hunt.ts、tailor.ts 等）
│       ├── job/                            # 多子命令的 verb 用文件夹承载
│       └── __tests__/                      # CLI 边界测试
├── mcp/                                # 表现层 — MCP SDK（共用同一个 AppContext）
├── serve/                              # 表现层 — 本地 HTTP daemon
│   ├── httpServer.ts                       # wolf serve 接口
│   ├── protocol.ts                         # HTTP request/response schema
│   └── impl/nodeHttpServerImpl.ts          # Node HTTP 实现
├── runtime/
│   └── appContext.ts                       # 手动 DI——连接所有 repo + service + app
├── application/                        # 用例编排
│   ├── <name>ApplicationService.ts         # 接口
│   └── impl/
│       ├── <name>ApplicationServiceImpl.ts # 实现
│       └── templates/                      # init 工作区 markdown 模板
├── service/                            # 领域服务
│   ├── ai/                                 # AI provider 注册表 + family 模块
│   ├── <name>Service.ts                    # 接口
│   └── impl/
│       ├── prompts/                        # system prompts（analyst / writers / fill）
│       ├── render/                         # shell.html + fit() 二分循环
│       └── <name>ServiceImpl.ts
├── repository/                         # 数据访问
│   ├── <name>Repository.ts                 # 接口
│   └── impl/
│       ├── drizzleDb.ts                    # DrizzleDb 类型别名
│       ├── schema.ts                       # Drizzle 表定义
│       ├── initializeSchema.ts             # CREATE TABLE IF NOT EXISTS
│       ├── sqlite<Name>RepositoryImpl.ts
│       └── fileProfileRepositoryImpl.ts    # 从磁盘读取 profiles/<id>/
└── utils/                              # 横切辅助工具
    ├── types/                              # 共享领域类型
    ├── errors/                             # 自定义类型错误类
    ├── config.ts                           # wolf.toml 读取（AppConfigSchema.parse）
    ├── env.ts                              # WOLF_* 环境变量
    ├── instance.ts                         # build-mode + workspace 解析
    ├── logger.ts                           # 结构化日志
    ├── schemas.ts                          # TOML 验证用 Zod schema
    └── parseModelRef.ts                    # "anthropic/claude-sonnet-4-6" → AiConfig
```

### 示例：tailor 跨层调用链（三 agent checkpoint 流水线）

```
CLI 解析 --job abc123 [--hint "focus on ML ops"]
  → [命令层] tailor({ jobId, hint })
      → [应用层] TailorApplicationService.tailor({ jobId, hint })
          → prepareContext → 加载 job/profile/resumePool、readJdText(jobId)、getWorkspaceDir(jobId)
          → ensureHintFile → 如果 hint.md 不存在或传了 --hint，写入 data/jobs/<dir>/src/hint.md
          → [服务层] TailoringBriefService.analyze(pool, jd, profile, aiConfig, hint)
              → Anthropic API → 返回 Markdown brief
          → 写入 data/jobs/<dir>/src/tailoring-brief.md
          → Promise.all:
              → [服务层] ResumeCoverLetterService.tailorResumeToHtml(pool, jd, profile, brief, ai)
                  → Anthropic API → 返回 HTML body
                  → [服务层] RenderService.renderPdf(html)       # Playwright + fit() 二分搜索
                  → 写入 data/jobs/<dir>/{src/resume.html, resume.pdf}
              → [服务层] ResumeCoverLetterService.generateCoverLetter(pool, jd, profile, brief, ai)
                  → Anthropic API → 返回 HTML body
                  → [服务层] RenderService.renderCoverLetterPdf(html)  # Playwright，自然布局（不走 fit）
                  → 写入 data/jobs/<dir>/{src/cover_letter.html, cover_letter.pdf}
      → ctx.jobRepository.update(jobId, { hasTailoredResume: true, hasTailoredCoverLetter: true })
      → return { tailoredPdfPath, coverLetterHtmlPath, coverLetterPdfPath, ... }
        # β.10h：Job 行只存 boolean；路径由 JobRepository.getArtifactPath
        # 通过约定路径解出。CLI 返回值仍带实际路径方便调用方使用。
  → CLI 打印 JSON 摘要
```

每一步也可以独立调用：`wolf tailor brief`、`wolf tailor resume`、`wolf tailor cover`。
只跑 writer 的步骤会从磁盘读取 brief；brief 不存在会清晰报错。

### 数据布局 —— prose 上磁盘、metadata 进 SQLite

`data/` 按实体分目录。SQLite 只存结构化字段；所有自由文本（JD、公司笔记、
analyst brief、resume/cover HTML、PDF）都以纯文件形式放在对应实体的目录里。
这让整个 workspace 可以 grep，也方便用户直接在任何 checkpoint 上手改。

```
data/
├── wolf.sqlite                             ← 只存结构化元数据，不含 prose 列
├── jobs/
│   └── <company>_<title>_<jobIdShort8>/
│       ├── src/
│       │   ├── hint.md                     ← // 注释头 + 用户引导
│       │   ├── tailoring-brief.md          ← analyst 产出；可编辑 checkpoint
│       │   ├── resume.html                 ← resume writer 产出
│       │   └── cover_letter.html           ← CL writer 产出
│       ├── resume.pdf                      ← 最终产物
│       └── cover_letter.pdf                ← 最终产物
└── companies/
    └── <company>_<companyIdShort8>/
        └── info.md                         ← 自由文本的雇主笔记（自动创建）
```

目录名带 UUID 前 8 位以在本地做区分；label 中的非字母数字被替换为 `_`。
仓库内部负责解析路径：`JobRepository.getWorkspaceDir(jobId)`、
`JobRepository.readJdText(jobId)`、`CompanyRepository.readInfo(companyId)`。

## 设计原则

1. **核心与接口无关** — 命令逻辑只在 `src/application/impl/`，不在 `src/cli/` 或 `src/mcp/`。CLI 和 MCP 是薄壳，负责解析输入、调用命令、格式化输出。
2. **类型即契约** — `src/utils/types/` 定义所有数据结构（Job、Resume、AppConfig），所有层都依赖它。这是唯一的真相来源。
3. **默认安全** — 破坏性操作（表单提交、发邮件）需要显式 flag（`--send`、去掉 `--dry-run`）。默认行为永远是预览/试运行。
4. **本地优先** — 所有职位数据、配置和定制简历都存在本地。核心状态不依赖云服务。

## 各层详解

### 1. CLI 层（`src/cli/`）

人类用户的入口。使用 **commander.js** 构建。

```
src/cli/
├── index.ts          # CLI 入口，注册所有命令
└── commands/         # 薄命令 wrapper 和相邻 CLI 边界测试
```

**职责：**
- 解析命令行参数和 flag
- 通过共享 `AppContext` 调用对应 application service
- 将返回值格式化为终端输出（表格、颜色、进度条）
- 处理交互式提示（如 `wolf init` 向导）

**不包含：** 业务逻辑、API 调用、数据访问。

**入口：** `wolf`（通过 `package.json` 的 `bin` 字段创建符号链接）

### 2. MCP 层（`src/mcp/`）

AI agent 消费者的入口。使用 **MCP SDK** 构建。

```
src/mcp/
├── server.ts         # MCP 服务器设置和生命周期
└── tools.ts          # Tool 定义，带类型化的输入/输出 schema
```

**职责：**
- 启动/停止 MCP 服务器（`wolf mcp serve`）
- 定义 tool schema（名称、描述、输入 JSON Schema、输出 JSON Schema）
- 将收到的 tool 调用映射到共享同一运行时行为的 CLI/application wrapper
- 返回结构化 JSON 结果（不带终端格式化）

MCP 层注册 build-aware 名称：stable build 使用 `wolf_*`，dev build 使用 `wolfdev_*`。当前 base tools 是 `hunt`、`add`、`score`、`tailor`、`fill`、`reach` 和 `status`；其中部分仍是 not-yet-implemented 的 roadmap surface。输入输出 schema 定义在 `src/mcp/tools.ts`。

### 3. CLI command wrappers（`src/cli/commands/`）

每个 verb 一个薄 wrapper。wrapper 调 `ctx.<verb>App.<method>(opts)`，再做必要的终端格式化；业务逻辑在对应的 `*ApplicationService` 里，wrapper 不 inline。

```
src/cli/commands/
├── add.ts            # → ctx.addApp.add(opts)
├── config.ts         # → ctx.configApp.get/set
├── doctor.ts         # → ctx.doctorApp.run + formatDoctor
├── env.ts            # → singleton EnvApplicationService（env 没有 DB 依赖）
├── fill.ts           # → ctx.fillApp.fill（stub-M4）
├── hunt.ts           # → ctx.huntApp.hunt（stub-M2）
├── init.ts           # → singleton InitApplicationService（wolf.toml 存在前就要跑）
├── job/
│   ├── index.ts          # re-export list/show helpers
│   └── list.ts           # → ctx.jobApp.list + formatJobList
├── profile.ts        # → ctx.profileApp.list/create/use/delete
├── reach.ts          # → ctx.reachApp.reach（stub-M5）
├── score.ts          # → ctx.scoreApp.score + formatScoreResult
├── status.ts         # → ctx.statusApp.summarize + formatStatus
└── tailor.ts         # → ctx.tailorApp.tailor / analyze / writeResume / writeCoverLetter
```

**每个 application-service 方法：**
- 接收一个类型化的 options 对象（定义在 `src/utils/types/`）
- 返回一个类型化的 result 对象（不直接打印任何东西）
- 处理自己的错误边界，向 CLI/MCP 暴露可格式化的结果或类型化错误
- 可完全独立测试（不依赖 CLI/MCP）

**示例签名：**

```typescript
// src/application/impl/addApplicationServiceImpl.ts
class AddApplicationServiceImpl {
  async add(options: AddOptions): Promise<AddResult> {
    // 接收已结构化的 { title, company, jdText, url? }，
    // 写入 SQLite，并返回 jobId。
  }
}

// src/application/impl/huntApplicationServiceImpl.ts
class HuntApplicationServiceImpl {
  async hunt(options: HuntOptions): Promise<HuntResult> {
    // Roadmap surface: provider ingestion 会接在这里。
  }
}

// src/application/impl/scoreApplicationServiceImpl.ts
class ScoreApplicationServiceImpl {
  async score(options: ScoreOptions): Promise<ScoreResult> {
    // poll: 拉取已完成 batch，解析结果并写回 Job.score / justification。
    // single: 载入 profile + 一个 job，同步调用 scoring service。
    // default: 载入 profile + 待评分 job，提交 score batch，之后 poll。
  }
}
```

### 4. 类型层（`src/utils/types/`）

Types 层定义了各层共享的数据结构，是 wolf 的 single source of truth。核心类型包括：

- `Company` — 公司是独立的一级实体，与 Job 分开存储。多个 Job 共享一条 Company 记录。`Job.companyId` 是 `Company.id` 的外键。`reach` 命令用 `Company.domain` 推断邮件格式。
- `Job` — 职位信息，核心数据对象，存入 SQLite。
- `Resume` — 解析后的简历结构。
- `Profile` — 每个 profile 的身份信息和简历来源。当前磁盘上的真实来源是 `profiles/<id>/profile.toml`：identity、contact、work authorization、job preferences、skills、经历、项目、教育、奖项和 builtin application questions 都在这一份受治理的 TOML 文件里。`FileProfileRepositoryImpl` 解析它，并为仍然消费 prose 的 AI-facing service 渲染 markdown view。每个 profile 文件夹还包含 `score.md`（profile-level scoring guidance）、`prompts/`（可编辑 strategy prompt pack）和 `attachments/`（可上传文件）。校验仍偏向内容形态：required TOML 字段要填，resume 内容要有足够实质条目；由命令调用时的 `assertReadyForTailor` 强制执行，并由 `wolf doctor` 主动提示。
- `AppConfig` — workspace 级配置，从工作区根目录的 `wolf.toml` 加载。包含默认 profile 名、各命令模型设置，以及 companion 设置（`servePort`、`maxStagehandSessions`、固定的 `browserMode`）。固定的 companion 浏览器模式表示：wolf 启动一个单独的 Google Chrome instance，使用工作区下 wolf 自己的持久 profile；用户可以在里面一次性安装 wolf companion 和密码管理器扩展，后续 `wolf serve` 会复用这个 profile。由 `AppConfigSchema`（zod）在解析时校验；不内嵌 profile 数据。
- 每个命令的 Options/Result 对。

完整定义在 `src/utils/types/`。

### 5. 工具层（`src/utils/`）

跨命令共享的辅助函数。

```
src/utils/
├── config.ts         # 读写工作区根目录的 wolf.toml（process.cwd()）
├── db.ts             # SQLite 数据库访问（Job 的 CRUD）
├── env.ts            # 读取 WOLF_* 系统环境变量（不使用 .env 文件）
└── logger.ts         # 结构化日志
```

### 6. 职位来源 Provider 系统

职位数据可以来自**多种不同渠道**。`hunt` 命令使用 **JobProvider** 抽象来支持可插拔的职位来源。

**为什么需要这个：** 不同用户有不同的职位数据来源，provider 系统允许灵活接入任意渠道。

`JobProvider` 接口只需实现 `name` 和 `hunt()` 两个成员。接口定义在 `src/service/jobProvider.ts`。

**内置 provider（计划中）：**

| Provider | 策略 | 说明 |
|---|---|---|
| `ApiProvider` | 从用户配置的 HTTP 端点拉取数据 | 通用 — 适配任意 JSON API；AI 从原始响应提取结构化字段 |
| `EmailProvider` | 解析求职提醒邮件（Gmail API） | 中等 — 需要邮件解析规则 |
| `BrowserMCPProvider` | AI 驱动的浏览，通过 Chrome BrowserMCP | AI 导航职位页面并提取列表 |
| `ManualProvider` | 用户粘贴 JD 或通过 `wolf hunt --manual` 输入（CLI） | 面向 CLI 用户；AI agent 使用 `wolf_add` 替代 |

**`hunt` 如何使用 provider（只负责接入）：**

```typescript
// src/application/impl/hunt/index.ts
export async function hunt(options: HuntOptions): Promise<HuntResult> {
  const providers = loadEnabledProviders(config);  // 从配置读取
  const allJobs: object[] = [];

  for (const provider of providers) {
    const jobs = await provider.hunt(options);
    allJobs.push(...jobs);
  }

  const deduped = deduplicate(allJobs);
  await db.saveJobs(deduped, { status: 'raw', score: null });
  return { ingestedCount: deduped.length, newCount: newJobs.length };
}
```

**`score` 如何处理接入的职位（纯 AI 打分，无代码 dealbreaker —— 见 DECISIONS.md 2026-05-04）：**

```typescript
// src/application/impl/scoreApplicationServiceImpl.ts
export async function score(options: ScoreOptions): Promise<ScoreResult> {
  // poll：拉取 provider 结果，把所有已完成的 score batch 中未消费的 item 落库。
  if (options.poll) {
    await batchService.pollAiBatches();
    for (const batch of await batchRepo.listCompletedByType('score')) {
      for (const item of await batchItemRepo.listByBatch(batch.id)) {
        if (item.consumedAt) continue;
        const parsed = parseScoreResponse(item.resultText ?? '');
        if (parsed.ok) await jobRepo.update(item.customId, { score: parsed.value.score, scoreJustification: parsed.value.justification });
        else            await jobRepo.update(item.customId, { status: 'error', error: 'score_error' });
        await batchItemRepo.markConsumed(item.id, new Date().toISOString());
      }
    }
    return { submitted: 0, filtered: 0, polled: completedCount };
  }

  const profileMd = await profileRepo.getProfileMd(profileId);
  const aiConfig = options.aiModel ? parseModelRef(options.aiModel) : defaultAiConfig;
  assertApiKey('ANTHROPIC_API_KEY');

  if (options.single) {
    const target = await pickOneCandidate(options);
    const { score, justification } = await scoring.scoreOne(target, jdText, profileMd, aiConfig);
    await jobRepo.update(target.id, { score, scoreJustification: justification });
    return { submitted: 1, filtered: 0, singleScore: score, singleComment: justification };
  }

  const candidates = await loadUnscoredJobs(options);
  const submission = await scoring.submitBatch(candidates, profileMd, profileId, aiConfig);
  return { submitted: submission.submitted, filtered: 0 };  // filtered 恒为 0，仅为类型兼容
}
```

打分 prompt 直接喂入由 `profile.toml` 渲染出来的 profile markdown view（特别是 job-preferences scoring notes）+ JD 正文 + 输出契约。模型输出 `<score>0–10</score><justification>...</justification>`，`parseScoreResponse` 把 `score / 10` 写入 `Job.score`。门槛由下游命令（如 `wolf tailor`）自行决定。

这个设计意味着：
- 新增职位来源 = 新增一个实现 `JobProvider` 的文件，不需要修改 `hunt.ts`
- 用户通过配置启用/禁用 provider
- 每个 provider 可以有自己的策略（HTTP API vs 邮件 vs 手动 vs BrowserMCP）
- Provider 之间**相互独立** — 某个来源失效，其他 provider 照常工作

### 7. Batch 基础设施

AI batch 任务（评分及未来的批量定制简历等）统一记录在 SQLite 的 `batches` 表中，与具体命令解耦。

**接口：**
- `BatchRepository`（`src/repository/batch.ts`）——save、getPending、markComplete、markFailed
- `BatchService`（`src/service/batch.ts`）——submit、pollAll

**`batches` 表 schema（`src/repository/impl/schema.ts`）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `batchId` | text | AI 服务商分配的 batch ID |
| `type` | text | `"score"`、`"tailor"` 等 |
| `aiProvider` | text | `"anthropic"` 或 `"openai"` |
| `submittedAt` | text | ISO 8601 时间戳 |
| `status` | text | `"pending"`、`"completed"`、`"failed"` |

**Poll 触发点：**
- `wolf score --poll` — 显式 poll，不提交新 batch

`BatchService.pollAll()` 获取已完成的 batch 并调用注册的结果回调。命令层不直接感知 `batchId`——batch 生命周期完全通过 `BatchService` 和 `BatchRepository` 管理。

### 8. 外部服务集成

每个外部服务只在 `src/application/impl/`、`src/utils/` 或 job provider 中被访问。CLI/MCP 层不直接调用外部服务。

| 服务 | SDK / 方式 | 使用者 |
|---|---|---|
| **Apify** | `apify-client` | 可选 — 由选择此策略的 provider 使用 |
| **Claude API** | `@anthropic-ai/sdk` | `hunt`（JD 评分）、`tailor`（简历改写）、`reach`（邮件起草） |
| **Playwright** | `playwright` | `fill`（表单检测、填写、提交、截图） |
| **BrowserMCP** | Chrome DevTools Protocol | `BrowserMCPProvider`（AI 驱动的职位页面导航） |
| **SQLite** | `better-sqlite3` | `db.ts`（职位存储、状态追踪） |
| **Gmail API** | `googleapis` | `reach`（发送邮件）、`EmailProvider`（解析求职提醒邮件） |

## 数据流示例

### `wolf hunt --role "Software Engineer" --location "NYC"`

```
CLI 解析参数
  → hunt({ role: "Software Engineer", location: "NYC" })
    → config.load()                           # 读取工作区根目录的 wolf.toml
    → providers.forEach(p => p.hunt(options)) # 运行所有已启用的 provider
    → deduplicate(allJobs)                    # 合并去重
    → db.saveJobs(jobs, { status: 'raw', score: null })  # 持久化原始数据到 SQLite
    → return { ingestedCount, newCount }
  ← CLI 输出接入摘要
```

### `wolf_add`（AI 编排流程）

```
用户向 AI 分享职位（截图 / 粘贴文本 / URL）
  → AI（Claude/OpenClaw）提取 { title, company, jdText, url? }
  → wolf_add({ title, company, jdText })
    → add({ title, company, jdText })
      → db.saveJob({ ...structured, status: 'raw', score: null })
      → return { jobId }
  → wolf_score({ jobIds: [jobId], single: true })   # 或 POST /api/score 携带 { jobIds, single: true }
    → score({ jobIds: [jobId], single: true })
      → scoring.scoreOne(job, jdText, profileMd, aiConfig)  # 同步 Haiku 调用
      → 解析 <score>0–10</score><justification>...</justification>
      → jobRepo.update(jobId, { score, scoreJustification })
      → return { submitted: 1, filtered: 0, singleScore, singleComment }
  ← AI 把分数和 justification 内联展示给用户，并询问是否定制简历
```

### `wolf score`（批量 batch 流程）

```
CLI 解析参数
  → score({ profileId })
    → jobRepo.query({ limit: 10_000 }).filter(j => j.score === null)   # 只取未评分职位
    → scoring.submitBatch(jobs, profileMd, profileId, aiConfig)         # 每个 job 一份 prompt，统一入队
    → BatchService.submitAiBatch(...)         # 写入 batches + batch_items；返回 wolf 内部 batchId
    → return { submitted, filtered: 0 }
  ← CLI 输出 batch 摘要；用户稍后 `wolf score --poll` 拉取结果
```

### `wolf tailor full --job <job_id> [--hint "..."]`

```
CLI 解析参数
  → tailor({ jobId, hint })
    → prepareContext: 加载 job/profile/resumePool + jobRepo.readJdText(jobId) + jobRepo.getWorkspaceDir(jobId)
    → ensureHintFile: 写入 data/jobs/<dir>/src/hint.md（不存在则写 header；传了 --hint 则覆盖）
    → analyst = TailoringBriefService.analyze(pool, jd, profile, ai, hint)
        → Claude → Markdown brief
        → 写入 data/jobs/<dir>/src/tailoring-brief.md
    → Promise.all:
        → ResumeCoverLetterService.tailorResumeToHtml(pool, jd, profile, brief, ai)
          → Claude → HTML body
          → RenderService.renderPdf(html)  # Playwright + fit() 二分搜索
          → 写入 data/jobs/<dir>/{src/resume.html, resume.pdf}
        → ResumeCoverLetterService.generateCoverLetter(pool, jd, profile, brief, ai)
          → Claude → HTML body
          → RenderService.renderCoverLetterPdf(html)  # Playwright，自然布局（不走 fit）
          → 写入 data/jobs/<dir>/{src/cover_letter.html, cover_letter.pdf}
    → db.updateJob(jobId, { hasTailoredResume: true, hasTailoredCoverLetter: true })
    → return { tailoredPdfPath, coverLetterHtmlPath, coverLetterPdfPath, ... }
  ← CLI 打印 JSON 摘要
```

只跑单步：`wolf tailor brief|resume|cover --job <id>`。resume/cover 步骤从磁盘读 brief；
brief 缺失会清晰报错，提示先运行 `wolf tailor brief`。

β.10h：制品路径不再持久化在 Job 行上，而是通过
`JobRepository.getArtifactPath(id, kind)` 从 `data/jobs/<dir>/` 约定解出。
Job 行存 4 个布尔（`hasTailoredResume` / `hasTailoredCoverLetter` /
`hasScreenshots` / `hasOutreachDraft`）—— `hasX = true` 表示"wolf 产出过这个
制品"，不保证文件当前还在磁盘上；消费方应处理 ENOENT。

β.7+：JD 文本存在 SQLite `jobs.description_md` 列（不再是 `jd.md` 磁盘文件）。
tailor 应用服务通过 `JobRepository.readJdText(jobId)` 读取。

### `wolf fill --job <job_id> --dry-run`

```
CLI 解析参数
  → fill({ jobId: "abc123", dryRun: true })
    → db.getJob(jobId)                       # 获取职位 URL
    → playwright.launch()                    # 启动浏览器
    → detectFormFields(page)                 # 扫描表单字段
    → mapFieldsToProfile(fields, config)     # 将字段映射到用户信息
    → if (!dryRun) fillAndSubmit(page, map)  # 填写表单（试运行时跳过）
    → screenshot(page)                       # 截图存证
    → return { fields, mapping, screenshotPath }
  ← CLI 打印检测到的字段表
```

### Companion `Autofill this page`

```
Side panel POST /api/fill/quick
  → CompanionActionApplicationService.quickFill({ jobId, tabId, userPrompt })
    → ServeBrowserManager.getPage(tabId)          # 只使用 wolf-controlled browser
    → StagehandFillService.fill(...)              # TODO: LOCAL observe/cache/replay
    → 如果 Stagehand 尚未接线,使用安全 Playwright fallback 填明显的 profile/contact 字段
    → 永远不点击 submit
    → 通过 GET /api/runs/:runId 返回 run status
```

Stagehand 依赖已经存在,但第一个 companion MVP 把真正的 Stagehand 执行留在
`StagehandFillService` 边界后面。直到该服务接上 CDP session pool 和 selector
cache 之前,autofill 仍然使用保守 Playwright fallback,并保持 no-auto-submit 规则。

## 文件系统布局

### 项目目录（`wolf/`）

源码、配置、文档。提交到 git。

### 工作区目录（用户自选的任意文件夹）

由 `wolf init` 在当前工作目录（`process.cwd()`）创建。用户决定放在哪里——`~/Documents/my-job-search/` 或任何地方都可以。

wolf 每次运行命令时都会在 `process.cwd()` 查找 `wolf.toml`。找不到则退出并提示"请先运行 wolf init"。

```
<workspace>/
├── wolf.toml           # 工作区级别配置：defaultProfileId、provider、hunt、reach
├── profiles/           # 每个 profile 的内容——可提交到 git（不在 gitignore 中）
│   └── <profileId>/    # 例如 profiles/default/
│       ├── profile.toml          # 身份、简历池、work auth、Q&A、打分事实
│       ├── score.md              # 可选的 profile-level scoring guidance
│       ├── prompts/              # 可编辑 strategy prompt pack
│       └── attachments/          # 可上传文件（成绩单、作品集等）
├── .gitignore          # 由 wolf init 自动生成
├── credentials/        # OAuth token（Gmail）—— gitignored
└── data/               # 生成的文件 —— gitignored
    ├── wolf.sqlite      # 结构化元数据、raw inbox、background AI batches
    ├── wolf-browser-profile/ # wolf-controlled browser 的持久 profile
    ├── jobs/
    │   └── <company>_<title>_<jobIdShort>/
    │       ├── src/
    │       │   ├── hint.md
    │       │   ├── tailoring-brief.md
    │       │   ├── resume.html
    │       │   └── cover_letter.html
    │       ├── resume.pdf          # 最终 PDF
    │       └── cover_letter.pdf    # 最终 PDF
    └── companies/
        └── <company>_<companyIdShort>/
            └── info.md             # 自由文本雇主笔记
```

Raw inbox 数据放在 SQLite 的 `inbox_items`，而不是每个 capture 一个文件夹。
该表只保存用户手动页面或 hunt 结果的原始 payload，以及处理状态
（`raw`、`queued`、`promoted`、`failed` 等）。用户显式触发付费处理时，
系统可以创建 `background_ai_batches` / shards / items。当前 companion MVP
也可以用保守的本地抽取路径，把 manual raw page 直接提升为 canonical `jobs`
rows；未来 AI promotion 可以替换这条路径，而不改变 inbox contract。成功的
AI 输出会立刻应用到 canonical job state；`background_ai_batch_items` 只短期
保留 debug payload。

> API key（`WOLF_ANTHROPIC_API_KEY` 等）以 shell 环境变量形式存储，永远不放在工作区。使用 `wolf env show` / `wolf env clear` 管理。

**`profiles/` 与 `data/` 的区别：**
- `profiles/` 存放用户自己编写的内容（profile 配置、简历内容池）。可提交到私有 git 仓库，实现多机同步。
- `data/` 存放生成的产物（SQLite 二进制、编译的 PDF、截图）。gitignored。

## 组件间通信

命令之间不直接调用。**SQLite 是共享通信总线。**

每个命令从数据库读取输入，执行工作，将结果写回数据库：

```
hunt()   ── 写入 → [SQLite: jobs 行（含 description_md）] ── 读取 → tailor()
tailor() ── 写入 → [SQLite: tailored_resume_pdf_path + data/jobs/<dir>/resume.pdf] ── 读取 → fill()
fill()   ── 写入 → [SQLite: status="applied" + screenshot_path] ── 读取 → reach()
reach()  ── 写入 → [SQLite: outreach_draft_path]
```

具体示例：

```typescript
// add/hunt：所有元数据入 Job 行，JD 文本通过 repo 写入
await jobRepo.save({ id: "abc", title: "SDE", companyId: "company-uuid", status: "new", score: 0.9, /* ...其他字段 */ })
await jobRepo.writeJdText("abc", jdText)   // β.7+：写入 jobs.description_md SQLite 列

// tailor：读 JD，翻转 Job 行上的"产出过此制品"布尔。
// β.10h：路径由 getWorkspaceDir + 固定文件名约定解出。
const jdText  = await jobRepo.readJdText("abc")
const pdfPath = await jobRepo.getArtifactPath("abc", "resume_pdf")  // <workspaceDir>/resume.pdf
await jobRepo.update("abc", { hasTailoredResume: true, hasTailoredCoverLetter: true })

// fill：读取职位，标记截图已产出 + 升级状态。
const job = await jobRepo.get("abc")  // job.hasTailoredResume 告诉我们 tailor 跑过了
await jobRepo.update("abc", { status: "applied", hasScreenshots: true })

// reach：写出 outreach 草稿，标记布尔。
await jobRepo.update("abc", { hasOutreachDraft: true })
```

这个设计意味着：
- 命令**完全独立** — 每个命令可以单独运行，无需导入其他命令
- 顺序灵活 — 由用户（或编排器）决定执行顺序
- 状态**可检查** — `wolf status` 读取同一个 SQLite
- 崩溃恢复免费 — 部分进度已经持久化

## 外部编排集成

wolf 的设计定位是**被编排，而非编排别人**。MCP 层已经将所有命令暴露为可调用的 tool。这意味着外部工作流引擎可以直接驱动 wolf，无需修改代码。

### n8n 集成

n8n 可以通过两种方式调用 wolf：

```
┌────────────────────────────────────────────────────┐
│  n8n 工作流                                        │
│                                                    │
│  [触发器] → [执行: wolf hunt --json]               │
│                     ↓                              │
│           [如果 score > 0.8]                       │
│              ↓           ↓                         │
│  [执行: wolf tailor]     [跳过]                    │
│              ↓                                     │
│  [执行: wolf fill --dry-run]                       │
│              ↓                                     │
│  [人工审批节点]                                     │
│              ↓                                     │
│  [执行: wolf reach --send]                         │
└────────────────────────────────────────────────────┘
```

- **方式 A：CLI shell 执行** — n8n 的"执行命令"节点运行 `wolf hunt --json`、`wolf tailor --json` 等。`--json` flag 让 wolf 输出机器可读的 JSON 而非终端表格。
- **方式 B：MCP 客户端** — n8n 连接 `wolf mcp serve` 作为 MCP 客户端，直接调用 `wolf_hunt`、`wolf_tailor`，使用结构化输入/输出。

### LangGraph / AI agent 集成

任何 LangGraph agent（或类似框架）都可以通过 MCP 将 wolf 作为 tool provider 使用：

```
┌──────────────────────────────────────────────┐
│  LangGraph agent                             │
│                                              │
│  [状态: 职位搜索] → 调用 wolf_hunt           │
│         ↓                                    │
│  [状态: 评估]     → 读取结果，做决策          │
│         ↓                                    │
│  [状态: 定制]     → 调用 wolf_tailor         │
│         ↓                                    │
│  [状态: 申请]     → 调用 wolf_fill           │
│         ↓                                    │
│  [状态: 推广]     → 调用 wolf_reach          │
└──────────────────────────────────────────────┘
```

Agent 连接 wolf 的 MCP 服务器，将每个 wolf tool 视为其图中的一个节点。Wolf 处理求职相关的具体逻辑；agent 处理编排、分支和人工介入决策。

### 设计约束

为了保持对外部编排器的友好性：
1. **所有命令支持 `--json` 输出** — 机器可读，不带 ANSI 颜色
2. **所有命令尽可能幂等** — 对同一个 job 运行两次 `tailor` 会安全覆盖上一次的结果
3. **MCP tool 有严格的输入/输出 schema** — 外部工具可以在调用前验证
4. **命令之间不共享内存状态** — SQLite 是唯一的共享状态，任何进程都可以读取

## 构建与运行

```
TypeScript (src/)  →  tsc  →  JavaScript (dist/)  →  node dist/cli/index.js
                                                   →  node dist/mcp/server.js
```

- `npm run build` — 将 TypeScript 编译到 `dist/`
- `npm run dev` — 使用 `tsx` 或 `ts-node` 的 watch 模式
- `wolf --help` — CLI（通过 `package.json` `bin`）
- `wolf mcp serve` — 启动 MCP 服务器

## 安全考虑

- **API key** 以 `WOLF_*` 前缀存储在 shell 系统环境变量中，永远不放在 workspace 目录里——workspace 可能被共享、云同步或与简历文件一起打包。使用 `wolf env show` / `wolf env clear` 管理。
- **Gmail OAuth token** 存储在 `~/.wolf/credentials/`，永远不提交
- **表单填写** 默认试运行；实际提交需要显式 `--no-dry-run` 或确认
- **邮件发送** 需要 `--send` flag 加交互确认
- **数据不出本机**，除非通过显式的 API 调用（Claude、Gmail 以及你配置的 provider API）

## 测试策略

### 测试驱动开发（TDD）

**所有新功能和命令必须遵循测试驱动开发：**

1. **先写失败的测试** — 在写实现之前定义预期行为
2. **实现直到测试通过** — 写满足测试的最少代码
3. **放心重构** — 测试保护你不引入回归

这对 AI 集成的功能（评分、简历改写、邮件起草）尤其关键。使用 mock AI 响应的测试充当**幻觉防护栏** — 它们定义了预期的输出结构和约束，捕获 AI 返回畸形、跑题或捏造数据的情况。

**示例 — 测试 `hunt` 评分：**

```typescript
// 先写这个：
it('应拒绝超出 0.0-1.0 范围的 AI 分数', async () => {
  mockClaude.returns({ score: 1.5 }); // 幻觉分数
  await expect(hunt(options)).rejects.toThrow('Score out of range');
});

it('应要求分数说明字段', async () => {
  mockClaude.returns({ score: 0.8 }); // 缺少说明
  await expect(hunt(options)).rejects.toThrow('Missing justification');
});

// 然后在 hunt.ts 中实现验证
```

### 测试层级

- **单元测试**：测试 `src/application/impl/` — mock 外部服务，测试业务逻辑
- **集成测试**：测试 CLI 和 MCP 层 — 验证参数解析和输出格式化
- **端到端测试**：测试 `wolf fill` — 用 Playwright 对样例表单运行测试
- 测试框架：vitest（轻量、TypeScript 原生支持）

### AI 幻觉防护

使用 Claude API 的命令必须验证 AI 响应：

| 命令 | 验证内容 |
|---|---|
| `hunt`（评分） | 分数是 [0.0, 1.0] 范围内的数字，说明是非空字符串 |
| `tailor`（改写） | 输出保留简历结构，无捏造的经历或技能 |
| `reach`（邮件草稿） | 邮件包含输入中的正确公司/职位名称，无虚构事实 |

所有验证都通过**在实现之前编写的测试**来强制执行。

### CI/CD

GitHub Actions CI 从 Milestone 1 起已启用。每次 push 和 PR 都会触发流水线。

**当前流水线：**

```
push / PR → 构建 (tsc) → 测试 (vitest)
```

**计划新增：**
1. **Milestone 2+：** 加入 lint（ESLint）和类型检查（`tsc --noEmit`）步骤。
2. **Milestone 3+：** 将 E2E 测试加入 CI。PR 必须通过所有检查才能合并。
3. **Milestone 5+：** 添加发布自动化（changelog 生成、npm publish）。

**规则：** 没有通过测试的代码不得合并到 `main`。CI 是执行者，不靠人的自觉。
