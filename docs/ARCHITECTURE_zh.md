# 架构 — wolf

## 概览

wolf 是一个双接口应用：既可以作为 **CLI 工具**（供人类用户使用），也可以作为 **MCP 服务器**（供 AI agent 如 OpenClaw 使用）。两个接口共享同一套核心命令逻辑，无论如何调用，行为保持一致。

```
                ┌─────────────────────────────────────────────┐
                │                  消费者                      │
                │                                             │
                │   人类（终端）          AI Agent（OpenClaw）  │
                └──────┬──────────────────────────┬───────────┘
                       │                          │
                       v                          v
                ┌─────────────┐          ┌────────────────┐
                │  CLI 层     │          │   MCP 层       │
                │ commander.js│          │   MCP SDK      │
                └──────┬──────┘          └───────┬────────┘
                       │                         │
                       └────────┬────────────────┘
                                │
                                v
                ┌──────────────────────────────┐
                │       命令层（核心）           │
                │  hunt / tailor / fill / reach │
                │           status             │
                └──────┬───────────────┬───────┘
                       │               │
              ┌────────┴───┐     ┌─────┴──────────┐
              v            v     v                 v
        ┌──────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐
        │ 外部服务  │ │ AI 层  │ │ 浏览器层  │ │ 本地存储 │
        │ External │ │ Claude │ │Playwright│ │ SQLite  │
        │ Gmail    │ │  API   │ │          │ │         │
        └──────────┘ └────────┘ └──────────┘ └─────────┘
```

## 设计原则

1. **核心与接口无关** — 命令逻辑只在 `src/commands/`，不在 `src/cli/` 或 `src/mcp/`。CLI 和 MCP 是薄壳，负责解析输入、调用命令、格式化输出。
2. **类型即契约** — `src/types/` 定义所有数据结构（Job、Resume、AppConfig），所有层都依赖它。这是唯一的真相来源。
3. **默认安全** — 破坏性操作（表单提交、发邮件）需要显式 flag（`--send`、去掉 `--dry-run`）。默认行为永远是预览/试运行。
4. **本地优先** — 所有职位数据、配置和定制简历都存在本地。核心状态不依赖云服务。

## 各层详解

### 1. CLI 层（`src/cli/`）

人类用户的入口。使用 **commander.js** 构建。

```
src/cli/
├── index.ts          # CLI 入口，注册所有命令
└── formatters.ts     # 终端输出格式化（表格、颜色等）
```

**职责：**
- 解析命令行参数和 flag
- 调用 `src/commands/` 中对应的函数
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
- 将收到的 tool 调用映射到 `src/commands/` 中对应的函数
- 返回结构化 JSON 结果（不带终端格式化）

MCP 层注册了 5 个工具（`wolf_hunt`、`wolf_tailor`、`wolf_fill`、`wolf_reach`、`wolf_status`），每个直接映射到 `src/commands/` 中的同名函数。输入输出 schema 见 [TYPES_zh.md § MCP Tool Schema](TYPES_zh.md#mcp-tool-schema)。

### 3. 命令层（`src/commands/`）

wolf 的核心。每个文件导出一个 async 函数，包含一个命令的全部业务逻辑。

```
src/commands/
├── hunt/             # 职位接入 — 从 provider 拉取原始职位，存入数据库
├── score/            # 职位处理 — AI 字段提取、dealbreaker 过滤、评分
├── tailor/           # 简历定制
├── fill/             # 表单自动填写
├── reach/            # HR 联系人查找和推广
├── status/           # 职位追踪看板
├── env/              # API key 管理（set/show/clear）
└── init/             # 设置向导
```

**每个命令函数：**
- 接收一个类型化的 options 对象（定义在 `src/types/`）
- 返回一个类型化的 result 对象（不直接打印任何东西）
- 自行处理错误并返回结构化错误
- 可完全独立测试（不依赖 CLI/MCP）

**示例签名：**

```typescript
// src/commands/hunt/index.ts — 只负责接入
export async function hunt(options: HuntOptions): Promise<HuntResult> {
  // 1. 从配置加载已启用的 provider
  // 2. 依次运行每个 provider，收集原始 job 对象
  // 3. 跨 provider 去重
  // 4. 以 status: raw, score: null 存入数据库
  // 5. 返回接入数量
}

// src/commands/score/index.ts — 只负责处理
export async function score(options: ScoreOptions): Promise<ScoreResult> {
  // 1. 从数据库读取 score: null 的职位
  // 2. AI 字段提取（sponsorship、技术栈、远程、薪资）
  // 3. 应用 dealbreaker — 不合格职位存为 status: filtered
  // 4. 将剩余职位提交至 Claude Batch API（异步，立即返回）
  // 5. 返回提交数量和过滤数量
}
```

### 4. 类型层（`src/types/`）

Types 层定义了各层共享的数据结构，是 wolf 的 single source of truth。核心类型包括：

- `Company` — 公司是独立的一级实体，与 Job 分开存储。多个 Job 共享一条 Company 记录。`Job.companyId` 是 `Company.id` 的外键。`reach` 命令用 `Company.domain` 推断邮件格式。
- `Job` — 职位信息，核心数据对象，存入 SQLite。
- `Resume` — 解析后的简历结构。
- `UserProfile` — 申请时使用的完整身份信息。wolf 支持**多个 profile**（如不同移民身份、ATS 绕过用的名字变体），`AppConfig.profiles` 是数组，`defaultProfileId` 指定默认值，`Job.appliedProfileId` 记录投递时使用了哪个 profile。
- `AppConfig` — 用户配置，从工作区根目录的 `wolf.toml` 加载。
- 每个命令的 Options/Result 对。

完整定义见 [TYPES_zh.md](TYPES_zh.md)。

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

`JobProvider` 接口只需实现 `name` 和 `hunt()` 两个成员。接口定义见 [TYPES_zh.md § Provider 接口](TYPES_zh.md#provider-接口)。

**内置 provider（计划中）：**

| Provider | 策略 | 说明 |
|---|---|---|
| `ApiProvider` | 从用户配置的 HTTP 端点拉取数据 | 通用 — 适配任意 JSON API；AI 从原始响应提取结构化字段 |
| `EmailProvider` | 解析求职提醒邮件（Gmail API） | 中等 — 需要邮件解析规则 |
| `BrowserMCPProvider` | AI 驱动的浏览，通过 Chrome BrowserMCP | AI 导航职位页面并提取列表 |
| `ManualProvider` | 用户粘贴 JD 或通过 `wolf hunt --manual` 输入 | 单条录入的最低门槛方式 |

**`hunt` 如何使用 provider（只负责接入）：**

```typescript
// src/commands/hunt/index.ts
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

**`score` 如何处理接入的职位：**

```typescript
// src/commands/score/index.ts
export async function score(options: ScoreOptions): Promise<ScoreResult> {
  const jobs = await db.getJobs({ score: null });           // 只取未评分职位
  const extracted = await ai.extractFields(jobs);           // AI 提取：sponsorship、技术栈、远程、薪资
  const { pass, filtered } = applyDealbreakers(extracted, profile);
  await db.updateJobs(filtered, { status: 'filtered' });
  await batch.submit(pass, { type: 'score', profile });     // batchId 存入 batches 表
  return { submitted: pass.length, filtered: filtered.length };
}
```

这个设计意味着：
- 新增职位来源 = 新增一个实现 `JobProvider` 的文件，不需要修改 `hunt.ts`
- 用户通过配置启用/禁用 provider
- 每个 provider 可以有自己的策略（HTTP API vs 邮件 vs 手动 vs BrowserMCP）
- Provider 之间**相互独立** — 某个来源失效，其他 provider 照常工作

### 7. Batch 基础设施（`src/utils/batch.ts`）

AI batch 任务（评分及未来的批量定制简历等）统一记录在 SQLite 的 `batches` 表中，与具体命令解耦。

**`batches` 表（计划 schema）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `batchId` | string | AI 服务商分配的 batch ID |
| `type` | string | `"score"`、`"tailor"` 等 |
| `aiProvider` | string | `"anthropic"` 或 `"openai"` |
| `submittedAt` | string | ISO 8601 时间戳 |
| `status` | string | `"pending"`、`"completed"`、`"failed"` |

**Poll 触发点：**
- `wolf status` — 展示结果前先 poll 所有 pending batch
- `wolf score --poll` — 显式 poll，不提交新 batch

每种 `type` 在 `batch.ts` 中注册一个回调。batch 完成后，回调将结果写回 `jobs` 表。命令层不直接感知 `batchId`——batch 生命周期完全由 `utils/batch.ts` 管理。

### 8. 外部服务集成

每个外部服务只在 `src/commands/`、`src/utils/` 或 job provider 中被访问。CLI/MCP 层不直接调用外部服务。

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

### `wolf score`

```
CLI 解析参数
  → score({ profileId })
    → db.getJobs({ score: null })             # 获取所有未评分职位
    → ai.extractFields(jobs)                  # Claude 提取：sponsorship、技术栈、远程、薪资
    → applyDealbreakers(jobs, profile)        # 硬性过滤 — 不合格职位 → status: filtered
    → batch.submit(remaining, profile)        # 提交至 Claude Batch API（异步，立即返回）
    → return { submitted, filtered }
  ← CLI 输出 batch 摘要；评分在后台完成
```

### `wolf tailor --job <job_id>`

```
CLI 解析参数
  → tailor({ jobId: "abc123" })
    → db.getJob(jobId)                       # 从本地数据库获取 JD
    → profile.resumePath                     # 从 profile 获取基础 .tex 简历路径
    → parseResume(resumePath)                # 将 .tex 解析为结构化 Resume
    → claude.tailorResume(resume, job.desc)  # AI 改写
    → writeFile(tailoredTexPath, result)     # 保存定制版 .tex
    → xelatex(tailoredTexPath)              # 编译为 PDF
    → return { tailoredTexPath, tailoredPdfPath, coverLetterMdPath, coverLetterPdfPath, changes, matchScore }
  ← CLI 打印 diff 和摘要
```

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

## 文件系统布局

### 项目目录（`wolf/`）

源码、配置、文档。提交到 git。

### 工作区目录（用户自选的任意文件夹）

由 `wolf init` 在当前工作目录（`process.cwd()`）创建。用户决定放在哪里——`~/Documents/my-job-search/` 或任何地方都可以。

wolf 每次运行命令时都会在 `process.cwd()` 查找 `wolf.toml`。找不到则退出并提示"请先运行 wolf init"。

```
<workspace>/
├── wolf.toml         # 用户配置：profile、provider、评分偏好（TOML，可手动编辑）
├── .gitignore        # 由 wolf init 自动生成
├── resume/           # 用户的简历文件（用户自行管理）
├── credentials/      # OAuth token（Gmail）—— gitignored
└── data/             # 生成的文件 —— gitignored
    ├── wolf.sqlite   # 职位列表、状态、分数
    ├── tailored/     # 生成的定制简历（.tex + .pdf）
    ├── screenshots/  # 表单填写截图（审计用）
    └── outreach/     # 推广邮件草稿
```

> API key（`WOLF_ANTHROPIC_API_KEY` 等）以 shell 环境变量形式存储，永远不放在工作区——工作区可能被共享、云同步或与简历文件一起打包。使用 `wolf env set` 将它们配置到 `~/.zshrc`。

## 组件间通信

命令之间不直接调用。**SQLite 是共享通信总线。**

每个命令从数据库读取输入，执行工作，将结果写回数据库：

```
hunt()   ── 写入 → [SQLite: jobs 表] ── 读取 → tailor()
tailor() ── 写入 → [SQLite: tailored_resume_path] ── 读取 → fill()
fill()   ── 写入 → [SQLite: status="applied"] ── 读取 → reach()
reach()  ── 写入 → [SQLite: outreach_draft_path]
```

具体示例：

```typescript
// hunt：保存发现的职位（companyId 引用 Company 表）
db.saveJob({ id: "abc", title: "SDE", companyId: "company-uuid", status: "new", score: 0.9 })

// tailor：读取职位，写回定制 .tex + .pdf 路径
const job = db.getJob("abc")
db.updateJob("abc", { tailoredResumePath: "./data/tailored/abc.tex", tailoredResumePdfPath: "./data/tailored/abc.pdf" })

// fill：读取职位 + 简历路径，更新状态
const job = db.getJob("abc")  // 包含 job.url + job.tailoredResumePath
db.updateJob("abc", { status: "applied", screenshotPath: "./data/screenshots/abc.png" })

// reach：读取职位，写入推广草稿路径
const job = db.getJob("abc")  // 包含 job.companyId, job.title
db.updateJob("abc", { outreachDraftPath: "./data/outreach/abc.md" })
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

- **单元测试**：测试 `src/commands/` — mock 外部服务，测试业务逻辑
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
