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
**AI：** `wolf.toml` 放在工作区根目录，存储工作区级别的设置（数据源、`default_profile`、数据库路径）。每个 profile 文件夹（`data/<profileId>_<label>/`）下有各自的 `profile.toml`，存储 per-profile 设置（姓名、邮箱、简历路径、评分偏好、移民身份、portfolioPath、transcriptPath）。
**结果：** 采用。`wolf.toml` 是工作区入口；所有 profile 相关数据存在 profile 文件夹下的 `profile.toml` 中。需要 profile 数据的命令先读 `wolf.toml` 确定当前 profile ID，再加载对应的 `profile.toml`。

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
