# 决策日志 — wolf

Milestone 1 期间的决策根据 commit 历史和对话记录进行了追溯整理。从 Milestone 2 开始，决策将以 GitHub Issue（打 `decision` 标签）的形式实时记录。

---

**2026-03-17 — 先写文档再写代码**
**我：** 在任何源代码之前先写架构文档和里程碑规划。
**AI：** 认可。强制提前做出明确决策，也给贡献者提供了一份地图。
**结果：** 采用。所有文档在第一个 `.ts` 文件之前完成。

---

**2026-03-18 — 用 SQLite 作为通信总线**
**我：** 各命令之间不应该互相调用，通过数据库共享状态？
**AI：** 认可。另外补充：崩溃恢复和 `wolf status` 功能自然就有了。
**结果：** 采用。SQLite 是命令之间唯一的共享状态。

---

**2026-03-18 — CLI 和 MCP 共用同一个命令层**
**我：** 不想为 CLI 和 MCP 写两套逻辑。
**AI：** 薄包装模式——`src/commands/` 持有逻辑，CLI/MCP 只是适配器。
**结果：** 采用。核心逻辑从一开始就与接口无关。

---

**2026-03-18 — JobProvider 插件模式**
**我：** 数据源之前是硬编码的。我提出 LinkedIn、Handshake、邮件提醒、手动录入在实际操作中差异很大，没有一种通用的接入策略。
**AI：** 提议了 `JobProvider` 抽象。添加新数据源 = 新建一个文件，不修改 `hunt.ts`。
**结果：** 采用。顺带衍生出了 `BrowserMCPProvider` 和 `ManualProvider`，都是我最初没有规划的数据源。

---

**2026-03-18 — 公司作为一等实体**
**我：** 职位级别的数据不够。很多同学只盯着固定的一批公司——这是一个关注列表，不是职位搜索字段。需要第二个实体。
**AI：** 认可。另外补充：`reach` 需要 `Company.domain` 来推断邮件格式；稳定的 `companyId` 可以给目标公司评分加成。
**结果：** 采用。`Company` 成为独立的数据表，`Job.companyId` 作为外键。

---

**2026-03-18 — 多 Profile 支持**
**我：** 用户可能需要多个身份——不同的姓名、邮箱或移民身份用于不同申请（ATS 规避、多租户场景）。
**AI：** 认可。提议 `profiles[]` + `defaultProfileId` + 每个职位记录 `appliedProfileId`，方便追溯使用了哪个身份。
**结果：** 采用。每个 profile 有自己的简历、联系信息、移民身份和评分配置。

---

**2026-03-18 — 混合评分：算法 + AI**
**我：** 纯 AI 评分太慢、太贵，有没有更好的方法？
**AI：** AI 只处理 `roleMatch`（语义匹配），算法处理其余（地点、薪资、工作授权、公司规模）。一票否决项在评分前过滤，完全跳过 AI 调用。
**结果：** 采用。比纯 AI 评分更便宜、更快、更易调试。

---

**2026-03-18 — Jest → Vitest**
**我：** Jest 对 ESM 模块的 mock 支持很差，而 mock 是 AI 集成测试的核心需求。
**AI：** 已知痛点。Vitest 原生支持 ESM 和 mock，可以直接替换。
**结果：** 已切换。迁移只用了一个 commit，之后没有再出现问题。

---

**2026-03-18 — TDD 作为 AI 幻觉防护机制**
**我：** 计划开源。需要一个适用于所有贡献者（包括用 AI 写代码的人）的标准。
**AI：** TDD 在实现前先建立契约。对于 AI 集成功能，包含模拟错误响应的测试可以作为幻觉防护——AI 生成的代码必须通过这些测试。
**结果：** 作为全项目规则采用，记录在 CONTRIBUTING 中。为所有贡献者统一了 AI 编码工作流。

---

**2026-03-18 — 撤销共享 AI 客户端工具**
**我：** 是否应该有一个集中的 `ai.ts` 包装器？
**AI：** 值得尝试，但每个命令的 prompt 需求差异太大，难以通用化。
**结果：** 已撤销。各命令直接调用 Anthropic SDK。如果出现可复用的模式，可以再考虑引入包装器。

---

**2026-03-19 — 何时开源**
**我：** 现在开源并邀请同学贡献。
**AI：** 时机未到——空仓库吸引不了贡献者。先完成 Milestone 1 骨架，让项目跑起来再说。
**结果：** 认可。等 `wolf --help` 和 `wolf mcp serve` 可用后再开放贡献。

---

**2026-03-19 — 决策日志**
**我：** 写一份决策日志，记录 AI 辅助工作流供读者参考。
**AI：** 认可。回顾了 commit 历史，整理出 12 条记录，格式为：我 → AI → 结果。
**结果：** 本文件。

---

**2026-03-20 — 基于 pwd 的工作区，而非 `~/.wolf/`**
**我：** 用户应该能在任意文件夹中存放配置、简历和生成的文件，而不是藏在 `~/.wolf/` 里。在当前目录运行 `wolf init` 应该将该目录设为工作区。
**AI：** 认可。另外指出这与 AI agent 工作流完美契合——Claude Code 的上下文就是当前打开的文件夹，把 wolf 工作区放在同一位置可以消除跨目录跳转和权限问题。
**结果：** 采用。`wolf init` 在 pwd 中创建 `wolf.toml`。所有命令在 pwd 中查找 `wolf.toml`。生成的文件（定制简历、截图、草稿）放入工作区子目录。`~/.wolf/` 完全移除。

---

**2026-03-20 — 将设计决策记录在 DECISIONS.md 中**
**我：** Claude 应该在重要设计决策发生时提醒我记录下来。
**AI：** 认可。已在 CLAUDE.md 中添加工作流规则。
**结果：** 规则已添加。本条目就是元示例。

---

**2026-03-20 — API key 存在 shell 环境变量中，而非工作区的 `.env` 文件**
**我：** 工作区目录很可能会被云同步（iCloud/OneDrive）或与简历文件一起打包分享，`.env` 文件放在那里迟早会泄露。
**AI：** 认可。shell 环境变量不会进入工作区。加了 `WOLF_` 前缀以区分其他工具的 key。新增 `wolf env show` / `wolf env clear` 方便查看和清理。
**结果：** 采用。`wolf init` 不再创建 `.env`。所有 key 从 `process.env.WOLF_*` 读取。用户在 `~/.zshrc`（Mac/Linux）或 Windows 用户环境变量中设置。

---

**2026-03-21 — MCP stub handler 使用同步函数；实现时再改为 async**
**我：** 在 Claude Desktop 中调用 `wolf_tailor` 时挂起，没有任何响应——stub 抛出的 `throw new Error('Not implemented')` 产生了未处理的 rejected Promise。
**AI：** Stub handler 根本不需要调用底层命令。改为同步函数可以完全消除 async 路径，不可能挂起。同时添加了 `TODO(M2)` 注释，标记每个 handler 在命令实现后应替换为 `async/await` 的位置。
**结果：** 对四个命令工具全部采用。`wolf_status` 保持 async，因为它实际上需要读取 `wolf.toml` 和环境变量。

---

**2026-03-21 — 将 `wolf hunt`（接入）和 `wolf score`（处理）拆分为两个命令**
**我：** `wolf hunt` 承担了太多职责——在一次阻塞调用中完成了抓取、过滤和评分。希望评分可以独立运行，支持定时触发或由 agent 调用。
**AI：** 接入和评分的运行频率不同：hunt 可能每小时或按需运行，scoring 在 batch 结果返回后异步执行。分离后两者均可独立自动化。
**结果：** 采用。`wolf hunt` 拉取原始职位并以 `score: null` 保存。`wolf score` 读取未评分职位，通过 AI 提取结构化字段，应用 dealbreaker，再提交 Claude Batch API。两者均作为 CLI 命令和 MCP tool 对外暴露。

---

**2026-03-22 — 新增 `wolf add` 作为 AI 编排器的手动职位接入入口**
**我：** 当用户分享自己发现的职位（截图、粘贴的 JD、URL 内容）时，AI（Claude/OpenClaw）没有任何接口可以处理这种情况。考虑过做成 CLI 命令，但用户体验很差（用户无法输入结构化 JSON，更不用说粘贴截图了）。
**AI：** wolf 主要由 AI 编排器操作，而不是用户直接输入命令。AI 已经拥有用户的原始内容，可以自行提取结构。`wolf add` 应当是一个仅限 MCP 的接口，接收已结构化的数据——AI 调用方负责提取，wolf 负责存储。tool description 必须明确说明这种分工。
**结果：** 采用。`wolf_add` 作为 MCP tool 添加（无 CLI 对应命令）。AI 在调用前从用户输入中提取 `{ title, company, jdText, url? }`。wolf 存储职位并返回 `jobId`，供 AI 链式调用 `wolf_score` 或 `wolf_tailor`。

---

**2026-03-22 — `wolf score --single` 通过 Haiku 实现同步立即评分**
**我：** `wolf add` 之后，AI 应该能立即对该职位评分并将结果呈现给用户，而不是等待异步 batch。
**AI：** Batch API 的存在是为了批量评分省钱。对于用户主动触发的单条职位，同步调用 Haiku 才是正确选择：几秒钟而非几分钟/几小时，且单条评分的绝对费用差异可以忽略不计。
**结果：** 采用。`ScoreOptions.single: true` 跳过 Batch API，同步调用 Haiku。批量评分默认仍走 batch。

---

**2026-04-02 — jobs/evaluations 数据库拆分**
**我：** jobs 表把客观的 JD 事实（职位名、公司、原始 JD、结构化字段）和主观的 profile 相关数据（评分、过滤决定、选择状态、申请状态）混在一起。JD 的事实不会变；评估结果完全取决于用哪个 profile 来评分。
**AI：** 认同。提议拆分为两张表：`jobs`（不可变的 JD 缓存，与 profile 无关）和 `evaluations`（profile 相关：score、filterDecision、filterReason、scoreJustification、selected、status、tailoredResumePath）。同一职位被两个 profile 评分时，产生两条 evaluations 记录，但只有一条 jobs 记录。
**结果：** 采用。`jobs` 只存客观事实。`evaluations` 存所有主观和 profile 关联状态。外键：`evaluations.jobId → jobs.id`，`evaluations.profileId → profiles.id`。

---

**2026-04-02 — 多 Profile：可扩展但暂缓实现**
**我：** 重新审视 2026-03-18 的多 profile 决策。完整的多 profile 支持暂不在范围内，但架构不应阻碍日后扩展。
**AI：** jobs/evaluations 拆分已处理了核心需求。对于涉及 evaluations 的命令（`wolf score`、`wolf tailor`、`wolf list`），可选 `--profile <profileId>` 参数用于定位对应的 evaluation 记录。不传该参数时，wolf 从 `wolf.toml` 读取 `default_profile` 字段。日后支持多 profile 无需其他改动。
**结果：** 采用。多 profile 实现暂缓。`wolf.toml` 新增 `default_profile` 字段（由 `wolf init` 设置为 `"default"`）。所有涉及 evaluations 的命令接受可选的 `--profile` 参数。2026-03-18 条目的范围相应缩减。

---

**2026-04-02 — 配置拆分为两个 TOML：`wolf.toml`（工作区级别）+ `profile.toml`（per-profile）**
**我：** 全局工作区设置和每个 profile 的设置应该分开存放。单一的 `wolf.toml` 把不同作用域的内容混在一起。
**AI：** `wolf.toml` 放在工作区根目录，存储工作区级别的设置（数据源、`defaultProfileId`、hunt/reach 配置）。每个 profile 文件夹（`profiles/<id>/`）下有各自的 `profile.toml`，存储 per-profile 设置（姓名、邮箱、评分偏好、移民身份等）。
**结果：** 采用。`wolf.toml` 是工作区入口；所有 profile 相关数据存在 `profiles/<id>/profile.toml` 中。需要 profile 数据的命令先读 `wolf.toml` 确定当前 profile ID，再由 `FileProfileRepository` 加载对应的 `profile.toml`。

---

**2026-04-04 — 通过对排版参数二分搜索，自动将简历压缩至一页**
**我：** Claude 定制简历内容后，输出可能溢出到第二页，需要再次调用 LLM 让它写短一点。提出对排版参数（行距 → 字号 → 页边距）做二分搜索，在不修改内容的前提下强制输出一页。
**AI：** 验证通过。内容层由 Claude 处理，排版层由确定性算法处理。对行距（0.85–1.0）、字号（9.5–11）、页边距（0.3–0.5 in）依次二分，约 15–18 次 xelatex 编译即可收敛——耗时几秒，无需额外 API 调用。调整顺序按视觉破坏程度从小到大：行距优先，页边距最后。`microtype` 作为静态兜底写入模板。三步均失败时，向上抛出 `failed` 状态，提示用户手动删减内容，不允许静默失败。
**结果：** 采用，纳入 Milestone 3 tailor 流水线。TypeScript 实现，使用 `child_process.spawnSync` + `xelatex`。参数通过 `\def` 前缀注入 `\input{resume.tex}`。页数通过 `pdfinfo` 读取。详见 GitHub issue 中的实现规格。

---

**2026-03-25 — 在 `UserProfile` 中新增 `portfolioPath` 和 `transcriptPath`；只读，仅支持 PDF**
**我：** Portfolio 和 transcript 应像 `resumePath` 一样按 profile 独立配置，但 wolf 永远不应修改这些文件。
**AI：** 两个字段沿用与 `resumePath` 相同的 per-profile 模式（存储在 `UserProfile`，通过 `wolf init` 配置）。两条约束在规范层面强制执行，并在 init 时校验：(1) 只读——wolf 可以附加或引用这些文件，但绝不允许写入；(2) 仅支持 PDF——不接受 `.tex` 或其他格式。
**结果：** 采用。`portfolioPath: string | null` 和 `transcriptPath: string | null` 添加至 `UserProfile`。`wolf init` 新增提示（可跳过，校验 `.pdf` 后缀）。与 `resumePath` 不同，这两个字段没有定制化处理流程，也永远不会有。

---

**2026-04-11 — 分层 DDD 架构替代基于工具函数的扁平结构**
**我：** 扁平架构（命令层直接调用工具函数）导致测试困难，层次不清晰。提议在 M2 开始前先进行 DDD 风格重构。
**AI：** 提出六层结构：Types → Repository → Service → Application → Commands → Presentation。每层只向下依赖。`AppContext` 作为手动 DI 容器——所有具体实现的唯一构建点。无需 DI 框架。
**结果：** 采用。在 PR #62、#63 中落地。原 `src/utils/db.ts` 被 `src/repository/` 层替代。新增 `src/service/` 层。`src/application/` 留作用例编排（M2+）。所有引用旧扁平架构的 issue 已关闭（not_planned）。

---

**2026-04-11 — 手动 DI 容器 AppContext**
**我：** 问在不引入 DI 框架的情况下如何处理依赖注入。
**AI：** 通过 `src/cli/appContext.ts` 中的单一 `AppContext` 对象进行手动构造函数注入。所有具体实现（repository、service）都在那里实例化并向下传递。替换真实为 mock = 修改一个文件，其他全不变。TypeScript 的 `implements` 在编译时保证接口合规。
**结果：** 采用。`AppContext` 是唯一 `new` 具体类的地方。命令层和应用层通过构造函数接收依赖，永远不自行实例化。

---

**2026-04-11 — `profiles/<id>/` 放在工作区根目录，而非 `data/` 内**
**我：** 早期设计将 profile 放在 `data/<profileId>_<label>/` 内。但 `data/` 是 gitignored（生成产物）。Profile 内容（简历内容池、个人配置）应该可以提交，以便多机同步。
**AI：** 将工作区拆成两个顶层目录：`profiles/`（用户编写，可提交）和 `data/`（生成产物，gitignored）。`profiles/<id>/profile.toml` + `profiles/<id>/resume_pool.md` 放在工作区根目录，而非 `data/` 内。
**结果：** 采用。`FileProfileRepository` 读取 `profiles/<id>/profile.toml` 和 `profiles/<id>/resume_pool.md`。`data/` 只存放 `wolf.sqlite` 和生成的 PDF/截图。

---

**2026-04-11 — 使用 Zod 对 TOML 文件进行运行时校验**
**我：** wolf.toml 和 profile.toml 是用户手动编辑的文件。没有运行时校验，缺少字段或类型错误会导致静默运行时错误或难以定位的崩溃。
**AI：** 在 `src/utils/schemas.ts` 中定义 Zod schema（`AppConfigSchema`、`UserProfileSchema`）。`config.ts`（wolf.toml）和 `FileProfileRepository`（profile.toml）在加载时均调用 `.parse()`。字段缺失或类型错误会立即抛出清晰的 Zod 错误。
**结果：** 采用。Schema 定义在 `src/utils/schemas.ts`。配置和 repository 加载路径在解析时校验，而不是等到首次使用时才出错。

---

**2026-04-12 — M3 简历渲染方案：HTML 而非 LaTeX**
**我：** POC 已验证 HTML → PDF via Playwright 的方案。与 LaTeX 相比，不需要 xelatex 系统依赖，HTML/CSS 迭代也更快。
**AI：** 验证通过。`fit()` 二分搜索算法（从 POC 移植到 `RenderService`）以确定性方式处理单页压缩。Claude 输出 HTML body，shell 和 CSS 是静态文件。用户无需安装 xelatex。
**结果：** M3 采用。`RenderServiceImpl` 封装 Playwright + `fit.ts`。简历 body 为 HTML；shell 为 `src/service/impl/render/shell.html`。M3 范围内移除 LaTeX 路径。

---

**2026-04-16 — Tailor 改为三 agent checkpoint 流程（分析员 + 写手）**
**我：** 原 tailor 只有一个 resume agent 和一个 cover-letter agent，两者各自读 pool+JD。结果产出不一致：resume 强调项目 A、B、C，CL 却强调 A、D、E——同一个候选人两种叙事。
**AI：** 拆成三个 agent，共享一份决策文档。Agent 1（分析员）读 pool+JD，产出 Markdown tailoring brief（选定角色、2-3 个项目、3 个核心主题、CL 切入角度）。Agent 2、3（resume writer、CL writer）读 brief + pool + JD 并行运行。两个 writer 的 system prompt 把 brief 作为选择的真相来源。Brief 格式考虑过 JSON，但两个消费者都是 LLM，散文对它们更自然；schema 校验 YAGNI。
**结果：** 采用。新增 `TailoringBriefService`（在 `src/service/` 下）。`TailorApplicationService` 暴露四个方法 —— `tailor`（编排三步）、`analyze`（只产 brief）、`writeResume`、`writeCoverLetter`，用户可以跑局部步骤，手动编辑 `data/<jobId>/src/tailoring-brief.md`，然后只重跑 writer 而不重跑分析员。可选的 `hint.md`（`//` 注释头被 `stripComments` 过滤）让用户或外部 AI agent 在分析员运行前对它进行引导。代价：每个 job 多一次 AI 调用（约 3 秒，可用 Haiku）。一致性收益足以抵消。

---

**2026-04-18 — 散文上磁盘，SQLite 只存元数据**
**我：** JD 文本和公司简介一直存在 SQLite 的 text 列里。能跑，但把散文塞进数据库不自然：从文件系统 grep 不到、不能手动编辑、也不好做 diff。而 profile 层早就把散文放在磁盘上（`resume_pool.md`），SQL 只存结构化字段——jobs 和 companies 应该遵循同一模式。
**AI：** 验证通过。JD 文本迁移到 `data/jobs/<dir>/jd.md`，公司信息迁移到 `data/companies/<dir>/info.md`。SQLite 只保留需要索引/查询的结构化字段。`JobRepository` 新增 `getWorkspaceDir` / `readJdText` / `writeJdText`；`CompanyRepository` 新增 `getWorkspaceDir` / `readInfo`。目录命名：`<safeLabel(company)>_<safeLabel(title)>_<shortId(jobId)>` 和 `<safeLabel(company)>_<shortId(companyId)>`——人类可读的标签加 8 位 hex 做消歧。`info.md` 在公司 upsert 时自动创建，带 `//` 自描述头，永不覆盖。拒绝方案：单独开一个 `JobDescriptionRepository`——按文件类型拆分，随着每个 job 的散文文件增多会组合爆炸。升级路径：如果此类 bloat 出现，再抽出 `JobWorkspaceRepository`。
**结果：** 采用。`Job.description` 从类型和 schema 中移除。`SqliteJobRepositoryImpl` 构造参数变为 `(db, companyRepository, workspaceDir)`，这样它能通过 companyId 查到公司名用于目录拼装（aggregate-root 模式，与 `ProfileRepository` 一致）。路径拼装逻辑放在 `src/utils/workspacePaths.ts` 中，并带单元测试。

---

**2026-04-18 — 结构化 logger：JSONL 文件 + stderr 控制台，不进 SQLite**
**我：** M2 开始之前需要一个真正的 logger。一开始纠结于日志级别列表（`debug` / `info` / `warn` / `error` 够不够，要不要加 `trace` / `critical`），但更关键的问题其实是*日志放哪里*。我考虑过在 SQLite 里开一张日志表——跟业务数据同库，能用 SQL 查询。
**AI：** 反对把日志塞进 SQLite。两件事关注点完全不同、写入画像完全不同。SQLite 日志表会带来：(1) schema 僵化——多一个字段就要 ALTER TABLE；(2) 写竞争——SQLite 在写时锁整个文件，MCP server 和 CLI 命令会互抢日志写锁；(3) 生命周期纠缠——截断日志就得碰业务数据；(4) 崩溃安全——SQL 事务写了一半 vs. 仅丢一行 JSONL；(5) 生态不匹配——Loki、Datadog、CloudWatch 等所有可观测性工具都期望 line-delimited JSON。提议：一个 logger，两个 sink。控制台 sink 写 **stderr**（不走 stdout——stdout 留给命令的实际输出，`wolf job ls | grep open` 才不会被日志污染；而且 MCP 用 stdout 传协议帧）。文件 sink 写 `data/logs/wolf.log.jsonl`——每行一个 JSON 对象，`jq` / `grep` 友好，将来能直接对接真的日志系统。采用四级（`debug` / `info` / `warn` / `error`）；`fatal` / `critical` 合并进 `error`，因为"是否终止"是调用方的决定，不是日志级别的属性。事件从一开始就结构化：`logger.info('msg', { jobId, ... })` 产出 `{ts, level, msg, ...fields}`——JSON 是内部事件形态，pretty 渲染只是其中一种投影。
**结果：** 采用。`src/utils/logger.ts` 定义 `Logger` / `LogEvent` / `LogSink` 接口，外加 `createConsoleSink`、`createFileSink`、`createMemorySink`（测试用）、`createSilentLogger`（测试 AppContext 用）。生产环境 `AppContext.logger` 同时挂 console + file 两个 sink；`createTestAppContext()` 用 silent logger。环境变量：`WOLF_LOG=debug|info|warn|error`（默认 `info`）、`WOLF_LOG_FORMAT=pretty|json`（默认 `pretty`，文件 sink 永远是 JSON）。SQLite schema 不动——日志按设计就是纯文件。

---

**2026-04-18 — Nouns over god-views：把 `wolf status` 拆成 dashboard + 各 noun 的 `list`**
**我：** 担心每加一个新功能（outreach、hunt、fill 等）都要改 `wolf status` 把自己那部分状态塞进去——典型的"什么都往里塞"的 god-view，很快就会腐烂。也担心终端溢出：hunt 回来 1000 条 job 一股脑打到 shell 里就没法看了。
**AI：** 两个问题一个解法——不要让 `status` 随功能增长。让"名词"（noun）增长。`wolf status` 变成**聚合计数仪表盘**，每个模块往 registry 里注册一个 `StatusCounter`（`{ label, count: () => Promise<number> }`）。新功能 = 往 registry 加一条；status 命令、service、其他计数器都不用改。各 noun 的 list 命令（`wolf job list`，之后 `wolf company list`、`wolf outreach list`）各自负责"带过滤的查询"。所有成熟 CLI（`git`、`kubectl`、`docker`、`gh`）都是这个形状。溢出由下面的 list 命令约定处理（默认 limit 20，明确 `--limit`，`--json` 对接管道）。在当前规模下 SQL 聚合查询是微秒级——不要过早优化。
**结果：** 采用。`src/application/statusApplicationService.ts` 定义 `StatusApplicationService`、`StatusCounter`、`StatusSummary`。`StatusApplicationServiceImpl` 用 `Promise.all` 并行跑 registry；单个 counter 抛异常时返回 `count: 0` + 内联 `error` 字符串（同时 warn 一条日志），不会因为一个坏了的 counter 把整个 dashboard 搞挂。Registry 在 `appContext.ts` 组装——起步三个：`tracked` / `tailored` / `applied`；hunt / fill / reach 上线时自行注册。`wolf job list` 取代老 `wolf status` 的列表语义，具体 flag 形态见下面的 2026-04-18 条目。

---

**2026-04-18 — `wolf <noun> list` 命令的统一形态**
**我：** `wolf job list` 刚落地，`wolf company list` / `wolf outreach list` 显然接下来也要做，我不想每个 list 命令都自己发明一套 flag。另外 `wolf job list` 的第一版有两个会蔓延的味儿要趁早止住：per-field 过滤 flag（`--company`，之后还会有 `--title` 等等，无限增长），以及 `--company` 的实现居然把所有公司全 load 到 JS 里做 substring 过滤。
**AI：** 所有未来的 `wolf <noun> list` 共用一套约定：

*通用 flag：*
- `--search <text>` —— 不区分大小写的子串匹配，**可重复**。多个 `--search` 在顶层 OR。**不**引入 query-language 语法（`|`、`&` 等）—— 一是 shell 冲突，二是容易滑坡成自制 DSL。要多个词就写多个 `--search`。
- `--start <date>`、`--end <date>` —— 接受 ISO-8601 或 `YYYY-MM-DD`；命令边界规整为标准 ISO。
- `--limit <n>` —— 默认 **20**。**不提供** `--all` 逃生通道。真想看全量：先 `wolf status` 看总数，再 `--limit <n>`。
- `--json` —— 机器可读输出。

*各命令的可搜字段：* `--search` 只匹配**散文型文本字段** —— 名称、标题、地点、描述等。枚举 / ID / URL / 结构化字段用各自专门的 flag（只在需要时再加）。`wolf job list`：`jobs.title`、`companies.name`（通过 LEFT JOIN）、`jobs.location`。`wolf company list`（未来）：`companies.name`、`companies.industry`、`companies.headquartersLocation`。JD 文本（`data/jobs/<dir>/jd.md`）**不**搜 —— data-layout 重构把 JD 放在磁盘上了，真要搜 `grep -l X data/jobs/*/jd.md` 一行解决。

*过滤永远走 SQL。*  绝不 `repository.query({})` + JS substring。`JobQuery.search: string[]` 和 `CompanyQuery.nameContains: string` 是仓储层新增字段；`sqliteJobRepositoryImpl.ts` 的 `buildConditionsWithSearch()` 把每个搜索词包成 `or(like(title), like(location), like(companies.name))`，只有在有 search 时才 JOIN companies 表，没有 search 的查询仍是纯 `SELECT FROM jobs`。

*命令边界做输入校验。* 坏输入（`--status bogus`、`--start not-a-date`、空的 `--search ""`）直接抛清晰错误，**绝不**静默返回零行。`types/job.ts` 的 `ALL_JOB_STATUSES` 是唯一真相；派生的 `JobStatus` 类型和校验器共享它，typo 没法和 union 漂移。
**结果：** 采用。`wolf job list` 今天就按这个形态发货（见 AC-08）。未来的 list 命令引用此约定继承。升级路径延迟到需要时再做：把每个命令的校验器 Zod 化；SQLite FTS5 做 JD 全文搜索；如果 `--limit` 上限开始掣肘再上 cursor 分页。

---

**2026-04-24 — 为 AI 编排验收测试隔离 dev/stable**
**我：** 验收测试需要让 AI agent 从 shell 层运行 `wolf` 命令，但同一台机器上也有真实 dogfood 数据。测试绝不能碰 `~/wolf`、`~/wolf-dev`、repo `data/` 或 shell RC 文件。
**AI：** 采用两个 build mode 和不同默认值。Stable build 来自 `npm run build`，读取 `WOLF_*`，默认 workspace 是 `~/wolf` 或 `WOLF_HOME`。Dev build 来自 `npm run build:dev`，优先读取 `WOLF_DEV_*`，再 fallback 到 `WOLF_*`，默认 workspace 是 `~/wolf-dev` 或 `WOLF_DEV_HOME`。本地 dev 调用方式是 `npm run wolf -- <command>`。自动化验收测试必须始终设置 `WOLF_DEV_HOME=/tmp/wolf-at-<ID>`，并且只能在 `/tmp/wolf-at-*` 下创建和删除文件。
**结果：** 采用。`src/utils/instance.ts` 统一负责 build mode、workspace、环境变量命名空间和 dev warning。`wolf init --empty --dev` 为 agent 创建 schema-valid 的 dev workspace。Dev CLI 输出带 warning，dev MCP 工具使用 `wolfdev_*` 名称并在响应里包含结构化 warning。

---

**2026-04-25 — Cover letter 自然布局渲染，不再单页 fit（Bug B2）**
**我：** 第一次端到端 acceptance 运行触发了 `CannotFillError`，每个 cover letter 渲染都被阻塞：250 字的 cover letter 默认字号下大约只有 545px 内容，960px 的页面上即便把 section-gap 拉满 + 字号涨到 14pt 也达不到 95% 填充阈值。fit 算法把 "内容太短" 当作 caller 的硬错（"让模型加 filler 后重试"），可 cover letter 本来就该简短。让 Claude 凑字数会降低质量。从概念上讲：单页 resume 必须是一页（HR 扫读），但 cover letter 没有这个约束 —— 不到一页可以，确实需要溢出到第二页也可以，HR 读 cover letter 是从头读到尾的。
**AI：** Cover letter 直接走自然 CSS 布局，丢掉 fit loop。`RenderService.renderCoverLetterPdf` 的 JSDoc 早就这么写了（"without the fit algorithm, natural layout preferred"），是 impl 在撒谎。重构 `RenderServiceImpl`：resume 保留 `fit()`（保留 `CannotFitError` / `CannotFillError` 路径），cover letter 走新的 `renderHtmlToPdfNatural`：加载 shell → 注入 body → 等字体 → `page.pdf({ printBackground: true, preferCSSPageSize: true })`。shell 的 `@page` 规则 + 已有的 h1/h2/h3 `page-break-inside: avoid` + `<p>` 的 `widows`/`orphans: 2`，多页分页效果开箱即用。cover letter prompt 删掉硬性的 "must fit on one page"，改成 250-300 字软目标，并明确说明留白或溢出到第二页都可以。触发本决策的 acceptance 运行：`test/runs/acceptance-20260425-163454/`。
**结果：** 采用。`RenderServiceImpl` 现在有两条路径 —— `renderResumePdfFit`（resume）和 `renderHtmlToPdfNatural`（cover），仅共享 prelude（`loadShellPage`）。`renderCoverLetterPdf` 不再抛 `CannotFitError` / `CannotFillError`。新增三个回归测试：cover letter buffer 返回、短内容不抛 `CannotFillError`、长内容不抛 `CannotFitError`。架构图同步标注 cover letter 为 "自然布局（不走 fit）"。

---

**2026-04-25 — Resume section 诚实性（pool 驱动）+ 顺序由用户决定（Bug B3）**
**我：** 同一次 acceptance 跑出来还发现 resume writer 在 pool 没 Education 时杜撰了 `Education: BS, Computer Science`。第一直觉是"把 Education 设为必需，缺就拒绝"，但仔细想是错的：bootcamp 毕业生没学位、应届第一份工没 Experience、所有履历都在 `## Experience` 里的人没 `## Projects`、`## Skills` 本身也是可选的。**根本不存在"必需 section"**。正确契约是：pool 决定有哪些 section、以什么顺序、用什么文字。Writer 是诚实的 —— 不杜撰、不省略、不重排。
**AI：** 重写 `tailor-system.md`：writer 的第一步是 inventory（看 pool 中哪些 `## 标题` 真的有内容），输出规则是：每个 section 输出一个 `<h2>`，**严格按 pool 的顺序**，**严格用用户写的标题原文**（`## Work Experience` 就是 "Work Experience"，不规整成 "Experience"），**绝不**输出 pool 不存在的 section。视觉样式 —— 大写渲染、字体、颜色 —— 是 template CSS 的事（`h2 { text-transform: uppercase }` 已经在干），writer 不决定大小写。每 section 的内容规则（Experience 类硬限制 3 bullet，optional section 1 行等）只约束密度，**不是**"必须存在"清单。`init/index.ts` 里 resume_pool 模板顶部加一个 "Section 诚实性 + 顺序" 的 `//` 自解释 header，让用户知道顺序权威在自己手上。`AC-04-2` 强化加两条：(1) 不杜撰整段 section、(2) section 顺序跟随 pool。Acceptance case：`tailor/TAILOR-04-section-honesty.md`，两个 sub-case —— 4a（pool 无 Education → 生成的 resume 不含 Education）和 4b（pool 顺序 Skills → Projects → Experience → Education → 生成的 resume 严格按这个顺序，**不**按惯例重排）。Unit 级守卫：`resumeCoverLetterService` 测试验证 service 把 writer HTML **原样**返回，service 层不注入任何 section。触发本决策的 acceptance 跑：`test/runs/acceptance-20260425-163454/`。
**结果：** 采用。Tailor system prompt 整体重写：删除了原来固定列出 Experience / Projects / Education / Skills 的 "Required HTML structure" 模板，改成 inventory-then-emit 流程。Resume-pool 模板加了新的 `//` header 说明排序权威与 section 可选性。`AC-04-2` 在 `ACCEPTANCE_CRITERIA.md`（和 `_zh`）加了两条新约束。新增 `TAILOR-04-section-honesty.md`（和 `_zh`）。Coverage 矩阵把 `AC-04-2` 行的覆盖更新为 TAILOR-01 + TAILOR-04。Pre-flight section 守卫、`--skip-section` CLI flag、独立 "checker" agent 这三种方案被考虑并明确拒绝：writer prompt 本身就是表达结构诚实性的天然位置，在"不再有必需 section"的模型上叠加确定性守卫只会从后门重新引入"这个 section 必须存在"的概念。

---

**2026-04-25 — Resume `CannotFillError` 是正确行为；说谎的是测试 fixture（B2-bis）**
**我：** Acceptance 第 3 次跑（B2 + B3 修复后）爆出新的 `CannotFillError`，这次是 **resume** 渲染。第一眼像 B2 从 cover letter 蔓延到 resume，仔细看不是：B3 修复（不再杜撰 section）让 fixture resume 客观变短 —— 5 个 bullet / 2 个 role，没 Education / Projects / Skills。fit 算法在 max section-gap + max font 下还是达不到 95% 填充阈值，正确拒绝。问题：默认拒绝是对的吗？**对。** 一份只填了 ~60% 页面的"单页"简历不是 wolf 的 bug，是糟糕的简历。HR 扫读 —— 半空的页面意味着"经验不够"。如果用户真的就只有这么点料，wolf 应该明确告诉他，不该静默生成一份稀薄 PDF 假装没事。正确修法两步：(a) 让 error message 带用户视角的诊断，告诉用户该补什么；(b) 修测试 fixture，用一份真实中级工程师的 pool 体量，让渲染器的 underflow 守卫是在测真实素材，而不是在测一个"靠 B3 时代杜撰才能跑过"的人造稀薄 pool。
**AI：** 重写 `CannotFillError` 和 `CannotFitError` 构造函数的 message：(1) 用日常英语说出失败模式（"too short" / "too long"），(2) 把上一次 fit 尝试的具体数字加进来（渲染了 Npx，目标 Mpx，填充 / 溢出 X%），(3) 明确告诉用户去 `resume_pool.md` 里改什么 —— underflow case 还专门加一句 "wolf will not fabricate content for you"，避免用户把它读成"让 Claude 加点 filler 凑字数"那种软建议。`renderService.test.ts` 加两个 unit test 钉住 message 契约：必须含 `resume_pool.md`、必须含诊断数字、**禁止**出现 "fabricate" / "invent" 字样。然后把 TAILOR-01 fixture pool 从 5 bullet / 2 role 改成 3 role + 2 project + Education + Skills（一份真实中级 data / backend 工程师 resume 的体量）。TAILOR-04 的 sub-case 同样加密度，但保留各自的结构变化：4a 仍然没 Education；4b 仍然 Skills 在最前面的乱序。两者改完后内容密度都足以让定制 resume 仅靠剩余 section 就能填满一页。触发本决策的 acceptance 跑：`test/runs/acceptance-20260425-190008/`。
**结果：** 采用。`src/service/impl/render/fit.ts` 的 `CannotFillError` / `CannotFitError` message 现在带诊断 + 行动建议。两个新 unit test 钉死 message 形态。TAILOR-01 / `_zh` fixture pool 替换成真实密集 pool（Northwind + Vega Logistics + Atlas Tools 三 role、两 project、Education、Skills line）；TAILOR-02 / TAILOR-03 通过 "use the same setup as TAILOR-01" 引用自动跟着升级。TAILOR-04 4a / 4b 的 pool 同步加密度，结构变化保留。渲染器的 underflow 守卫保留为有意行为 —— 被拒绝的两个替代方案是"resume 也丢 fit"（丢失"压成一页"这个核心承诺）和"graceful degrade，CannotFillError 时返回 best-effort PDF"（静默给出用户没批准的稀薄 resume，掩盖诊断信息，并训练用户接受过稀的 pool）。

---

**2026-04-26 — Profile 迁移：typed TOML → 三 MD 布局（E8）**
**我：** 原来的 `profile.toml` + `UserProfileSchema`（zod）模型一直在和真实使用场景对着干。Profile 内容大多是给 AI 读的自由文本：地址、"why this role" 模板、五年规划段落。强行套类型化 schema 的结果是：(a) 每加一个字段都要 schema bump + 迁移 + form 提示；或者 (b) schema 退化成一堆 `string | null` 槽位，AI 还是要重新解析一遍。同时有 senior / 国际背景的用户经常撞"字段不够用"—— 中间名、多重国籍、比"是 / 否"更细的 relocation preference。schema 还是一个不友好的编辑表面：TOML 引号规则 + zod 严格解析意味着多一个逗号或写错 key 就会让 `wolf init` 直接抛栈。
**AI：** 把 `profile.toml` 替换成 `profiles/<id>/` 下三个同级 MD 文件：`profile.md`（identity / contact / address / links / job preferences / demographics / clearance —— H1 = 大类，H2 = 字段，body = 答案）、`resume_pool.md`（已经是 MD）、`standard_questions.md`（给 `wolf fill` 用的问答库 —— H1 = 大类，H2 = 问题，body = 答案或思路）。再加 `attachments/` 子目录放可上传文件。Repository 退化成一个薄薄的文件读取器；`Profile` 类型缩成 `{ name, md }`。校验从 "schema 形态" 移到 "内容形态"：唯一契约就是某些 H1 大类下的 REQUIRED H2 在 strip 掉指引标记后 body 非空，外加 `resume_pool.md` 至少 5 行实质内容。校验在该校验的地方做 —— 命令调用时由 `assertReadyForTailor`（每个文件由 `wolf doctor`）执行，而不是解析时。代价：丢了 profile 字段的类型化补全，换来 (1) 普通用户可以真正编辑的表面；(2) 加字段零迁移；(3) AI 直接逐字读 prose，零格式转换；(4) git diff 可读。
**结果：** 采用。提交 4511499 落地，配套若干跟进（姓名拆 first/middle/last、预填默认值、清掉 EAD、扩 Job Preferences）。`UserProfile` 和 `UserProfileSchema` 删除；`Profile` 与 `ProfileRepository.getProfileMd / getResumePool / getStandardQuestions / getAttachmentsList` 是新接口。`wolf init` / `wolf init --empty` 写三份模板而不是一份 TOML。Acceptance / smoke spec + AC fixture 在同一提交链路里全部跟着改。

---

**2026-04-26 — Marker 约定：用 GitHub Alert 引用块承载运行期被剥离的指引**
**我：** 转向自由文本之后，需要一种方式把模板指引（"这一项必须答"、"用不上就留空"、"写一个灵活模板，AI 按公司适配"）放到模板里：(a) 运行时对 AI 不可见，避免它被混淆；(b) 用户编辑时能看见；(c) 最好在任何 Markdown 预览器里（GitHub / VS Code / Obsidian）都能渲染好看，让文件读起来像友好表单而不是裸骨架。第一版试过 HTML 注释 `<!-- -->`—— strip 时反而对 AI 可见（构建管道留着），用户在预览里看不到。完全反了。第二版用 `//` 前缀行 —— 没人渲染的私有约定。第三版用纯 `>` 引用块 —— 风险是用户合理内容也可能用引用（引 JD 的一句、引邮件、引论文段落）。
**AI：** 改用 **GitHub Alert 引用块**（`> [!IMPORTANT]`、`> [!TIP]`、`> [!NOTE]`、`> [!WARNING]`、`> [!CAUTION]`）作为模板指引约定。两层 strip：(1) 构建期通过 tsup 自定义 esbuild 插件剥掉 `.md` 文件中的 `<!-- ... -->` HTML 注释 —— 这层是 wolf 源码私有上下文，永远不进用户工作区；(2) 运行期由 `stripComments` 剥掉 `> [!XYZ]` 整段 alert 块（首行 + 后续连续 `>` 行），在任何 AI 读取或就绪检查之前。普通 `>` 引用块不剥 —— 那是用户合理内容。`> [!IMPORTANT]` 用于 REQUIRED 字段（用户必须答），`> [!TIP]` 用于建议 / 合理默认 / 可选提示。用户在现代预览器里看到的是一个样式化提示框，AI 在用户没答时看到的是一个干净的 H2 加空 body（这样 `assertReadyForTailor` 才能正确标"缺失"）。
**结果：** 采用。`src/utils/stripComments.ts` 终态只剥 `> [!XYZ]` 块 —— 不剥任意 `>` 引用。`tsup.config.ts` 带一个自定义 esbuild 插件，bundle 时剥掉 `.md` 里的 `<!-- ... -->`（保证发布产物里不留 wolf 内部 HTML 注释）。模板按约定整体重写。`wolf doctor` 和 `assertReadyForTailor` 都先 `stripComments(md)` 再 `extractH2Content`（曾出过一个 regression：`> [!IMPORTANT]` 的 body 被算成"已填"，导致刚 init 的 profile 错误地报 ready=true；两个调用点一并修，加了回归测试）。

---

**2026-04-26 — Tailor 鲁棒性：占位 profile / 空 pool 拒绝运行**
**我：** 三 MD 迁移解决了编辑 UX 问题，但带来一个新失败模式：用户跑 `wolf init` 后立刻跑 `wolf tailor`，AI 拿到一份 REQUIRED H2 全是 `> [!IMPORTANT]` 提示框 body 的 `profile.md` 加一份近乎空的 `resume_pool.md`，自信地杜撰一份简历 —— 错的姓名、编造的经历、发明的技能。用户快速扫一眼可能根本没察觉。更糟的是这一切静默发生 —— AI 不会拒绝，它只是开始幻觉。
**AI：** 双层防御。**第一层：让 AI 没东西可抄。** 把 `resume_pool.md` 里的占位示例（如 `### SWE — Acme \n*2024*\n - Built things.`）整段包进 `> [!TIP]` 块，运行时被剥掉，留给 AI 的只剩 section 标题 + 空 body，没东西可模仿。**第二层：运行期门禁。** 在 `tailorApplicationServiceImpl` 头部加 `assertReadyForTailor`，每次 tailor 调用都跑一遍。检查 (1) `profile.md` 中所有 REQUIRED H2 在 `stripComments` 后 body 非空；(2) `resume_pool.md` 至少 5 行实质内容（非空、非 markdown 标题、strip 后非 alert 块）。任意一项不满足就抛类型化 error 列出究竟缺什么 —— 绝不进入 AI 调用。代价：真实 profile 上零误报；5 行的下限远低于"任何有话可说的人都能写多少"。配套主动暴露面：`wolf doctor` 对三份文件跑同一组检查，按文件输出 READY / NOT READY 报告，用户不用真跑 tailor 也能查状态。
**结果：** 采用。`assertReadyForTailor` 在 `src/application/impl/tailorApplicationServiceImpl.ts`；`wolf doctor` 在 `src/commands/doctor/index.ts`。两者共用 `extractH2Content` + `stripComments`。Unit test 覆盖：REQUIRED 缺失、callout-only body 回归、5 行下限。CLI 注册 `wolf doctor` 并在未就绪时退出 1。

---

**2026-04-26 — 共享 AC fixture + 入 git 的 orchestrator 预设带模型分级**
**我：** Acceptance spec 一直把 fixture profile / pool 内容当 inline heredoc 抄进每个 case —— 一处改了别处不改，悄悄漂移。同时 `.claude/` 下的 agent 预设被当个人配置 gitignore 掉，每个 session 都得重新解释 smoke / AC orchestrator 的派发逻辑，也没办法在快速 smoke 跑（用 Haiku 足够）和判断密集 AC 跑（用 Sonnet 才值）之间强制分级。
**AI：** 一个 PR 两件事。(1) 把共享 profile + resume-pool fixture 移到 `test/fixtures/wolf-profile/<persona>/{profile,resume_pool}.md`。先两个 persona：`swe-mid`（中级后端）和 `ng-swe`（F-1 OPT 应届）。Acceptance case 通过路径引用，永不内联。(2) 把 `.gitignore` 从 `.claude/` 收窄到 `.claude/*` + `!.claude/agents/`，让 agent 预设可入 git，个人配置仍 gitignore。加两个 orchestrator 预设：`wolf-smoke-orchestrator.md`（用 `model: "haiku"` 派发 runner）和 `wolf-acceptance-orchestrator.md`（需要真实判断的 case 用 `model: "sonnet"` 派发）。两个 orchestrator 自身都跑 `model: sonnet`，因为路由本身就是判断密集环节。路径用 `REPO=$(git rev-parse --show-toplevel)`，预设跨机器可移植。
**结果：** 采用，提交 790d4ee 落地。AC 和 smoke spec 改成引 fixture 路径。`.claude/agents/wolf-{smoke,acceptance}-orchestrator.md` 入 git。`test/runs/` 下的运行报告仍 gitignore（运行产物，非源代码）。这样后续贡献者不用每个 session 复制粘贴 orchestrator 指令也能拿到一致的派发行为。

---

**2026-04-26 — 新增 `wolf doctor` 主动检查 profile 就绪**
**我：** 有了 `assertReadyForTailor` 之后，失败面从"AI 幻觉"变成了"用户跑 tailor，看到一个类型化 error，得仔细读才知道该改哪"。比之前好但还不够 —— 尤其是第一次用的人根本不知道 profile 里有哪些字段。想要一条一次性"我 profile 准备好了吗？"的命令，让用户在跑真正流水线之前能问一下。
**AI：** 加 `wolf doctor`（无 flag），加载默认 profile，按文件报告就绪状态：`profile.md`（REQUIRED H2 已填）、`resume_pool.md`（≥5 行实质内容）、`standard_questions.md`（strip 后 ≥3 个 H2 有答案）。每个文件给一行状态、一组缺失项、一行修复提示。最终输出整体 ready / not-ready。未就绪时退出 1，方便接 shell 脚本。纯函数（`doctor` 返回 `DoctorReport`，`formatDoctor` 渲染文本）便于测试。一个关键实现细节：必须先 strip 再 extract H2 —— 没这步的话，`> [!IMPORTANT]` 模板 body 会被算成"已填"，刚 init 的 profile 错误地报 READY。
**结果：** 采用，提交 90a0621 落地。`src/commands/doctor/index.ts` 导出 `doctor()` + `formatDoctor()`。在 `src/cli/index.ts` 注册。8 个 unit test 覆盖正常路径、每个文件的失败路径、callout-only 回归、formatter 输出。Help 字符串里把 `doctor` 列在 `init` 和 `hunt` 之间。Smoke 验过：刚初始化的空工作区会输出 NOT READY 列出每个 REQUIRED 字段；手动填好的 fixture 输出 READY。

---

**2026-04-27 — 严格分层重构（v2）：杀掉 `commands/` 这一层，所有 verb 都走 application**
**我：** PR #77 之后 wolf 留了一层不彻底的分层：简单命令（`config get/set`、`env show`、`profile list/use`、`init`）写在 `src/commands/<verb>/index.ts` 里，逻辑直接 inline；重命令（`tailor`、`status`）已经走 `src/application/`。这种不对称变成了每写一段逻辑都要问一遍的问题 —— "这个要不要起 application service？" —— 同时也给"反正命令小，inline 一下"的代码留了滑坡入口。v1 想搞一个并行的 `admin/` 目录承载小命令，纯属换个名字延续不一致。要的是一条规则：每个 CLI verb，哪怕只有三行，都调用 `ctx.<verb>App.<method>(opts)`，再不夹带别的。
**AI：** 严格五层。`src/cli/appContext.ts` → `src/runtime/appContext.ts`（CLI、MCP 共用）。`src/types/` 和 `src/errors/` 折进 `src/utils/`（横切辅助、类型、错误统一在一棵树下）。`src/utils/ai/` 提升为 `src/service/ai/`（AI 是领域能力，不是辅助）。`src/commands/` 从 13 个子目录扁平化为 `src/cli/commands/<verb>.ts`（job 因为有 `wolf job list` 和后续 `job get/info` 保留为文件夹）。每个 verb 抽出一个 `*ApplicationService` —— 包括之前 inline 的 `add`、`config`、`env`、`profile`、`doctor`、`init`、`job` —— 同时为 `hunt`、`score`、`fill`、`reach`（M2/M4/M5）建 stub 接口，让 `appContext` 现在就能注册，到对应 milestone 直接换实现不必动接线。`wolf init` 模板搬到 `src/application/impl/templates/`。两个无法接全量 `AppContext` 的 wrapper（`init` 在 `wolf.toml` 还不存在时就要跑；`env` 完全没有 DB 依赖，测试也承担不起在 wolf 项目根下打开 SQLite）以 module 单例方式实例化它们的 application service —— 逻辑仍在 application 层，只是给 bootstrap 留一个工效学例外。
**结果：** 在 `refactor/layer-v2` 分支落地。六阶段、13 个原子 commit。每步 build 都绿；tsc 仅余 `job-list.test.ts` 里 5 个预先就有的 `any` 错误。新的 `AppContext` 暴露 13 个 `*App`。`src/commands/` 删除；`cli/index.ts` 和 `mcp/tools.ts` 都从 `cli/commands/<verb>.ts` import。分层规则简化为一句话：_"每个 CLI 命令 —— 哪怕只有三行 —— 都路由到一个 application service；wrapper 里不夹带逻辑。"_
