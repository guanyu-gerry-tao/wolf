# 更新日志

wolf 所有显著变更记录在此。版本号遵循 [Semantic Versioning](https://semver.org/)
（`0.x` 例外：minor 升级到 `1.0` 之前可能包含 breaking change）。

## Unreleased — `feat/migration-runner-framework` 分支

在 v2 单文件 profile（β.1–.10c 已发布）之上的 schema 形状调整。所有破坏性
改动遵循 **pre-1.0 hard-cut** 策略——不写自动 migration；用户重新 `wolf
init` 即可看到新形状，`parseProfileToml` 在遇到 β.10g 之前的旧数据时会抛
出清晰的"重命名 / 重新 init"错误。

### Breaking changes

- **`profile.toml`：把伪 enum 字符串字段塌缩成 freeform 长文**（β.10f）：
  - `[job_preferences]` 5 个 `relocation_*` → 1 个 `relocation_preferences`。
  - `[job_preferences]` 6 个 `sponsorship_*` → 1 个 `sponsorship_preferences`。
  - `[clearance]` 4 个（`has_active` / `level` / `status` / `willing_to_obtain`）
    → 1 个 `clearance.preferences`。
- **`profile.toml`：`[form_answers]` 表并入 `[[question]]`**（β.10g）：
  - 6 个 form_answers（工作授权、sponsorship、relocation、薪资期望、"从哪听说"、
    "什么时候能开始"）变成 `WOLF_BUILTIN_QUESTIONS`（原 `WOLF_BUILTIN_STORIES`，
    现 23 条 = 6 短 ATS Q&A + 17 STAR 行为答）的 builtin 条目。
  - 字段重命名 `star_story` → `answer`；存储重命名 `[[story]]` → `[[question]]`；
    CLI：`wolf profile add story` → `wolf profile add question`；点路径
    `story.<id>.star_story` → `question.<id>.answer`。
- **`profile.toml`：`[skills]` 5 子字段塌缩成 1**（β.10i）：
  - `skills.{languages, frameworks, tools, domains, free_text}` → `skills.text`。
- **`profile.toml`：每个 `*.note` 改为内联渲染**（β.10i）：
  - tailor 上下文中 note 跟在所属 H1 块末尾，不再单独提取成 `## User notes`。
- **`jobs` 表：制品路径改成布尔 + 约定路径**（β.10h）：
  - 5 个可空字符串列（`tailored_resume_pdf_path` 等）删除；新增 4 个布尔
    （`has_tailored_resume` / `has_tailored_cover_letter` / `has_screenshots`
    / `has_outreach_draft`）。
  - 新增 `JobRepository.getArtifactPath(id, kind)` 按约定路径解析。
- **`jobs.salary` 拆成 `salary_low` + `salary_high`**（β.10j/k）：
  - 单列变成区间两端。`"unpaid"` 字符串 sentinel 已**移除**；两个字段都是
    纯 `number | null`。约定：`0` = 显式无薪、`null` = 未知 / JD 没列。
    `low=0 + high=N` 合法（例如无薪底薪 + 奖金上限）。

### Added

- `wolf job show <id>` / `wolf job get <id> <field>` /
  `wolf job set <id> <field> [value]` / `wolf job fields [name]` ——
  对称于 `wolf profile` 的 CLI 表面。写入走 `JobRepository.update` 单列
  patch；读取含 `description_md` JD 文本。`JOB_FIELDS` 元数据驱动
  `wolf job fields` + 类型强制（`enum` / `boolean` / `number` /
  `nullableEnum` 等）。
- `JobRepository.getArtifactPath(id, kind)` —— 5 个 per-job 制品的约定
  路径解析。JSDoc 明确"`hasX = true` ≠ 文件当前在磁盘"，消费方处理 ENOENT。
- `BuiltinQuestion.defaultAnswer?: string` —— 短答 Q&A（`how_did_you_hear`
  默认 "LinkedIn" 等）通过此字段携带预填值，`injectMissingBuiltinQuestions`
  懒加载补 entry 时一并播种。
- `parseProfileToml`：检测到旧 `[[story]]` 数组时抛出清晰的"重命名 / 重新 init"
  错误，避免 zod 的 `.default([])` 静默吞掉用户的 STAR 答案。
- `docs/dev/FIELDS_AUDIT.md` —— 仅供审查的字段快照（PROFILE_FIELDS、JOB_FIELDS、
  builtin questions、profile 数组）。

### Changed

- `PROFILE_FIELDS` 现在是单一真相：`wolf init` 模板、`wolf profile fields`
  列表、doctor 的必填集合、3 个 markdown renderer、`wolf context --for=search`
  字段选择都从这一处声明驱动。新增 profile 字段是一处 PROFILE_FIELDS 改动 +
  对应 zod schema 同步（CI 测试双向 pin 对齐）。
- Renderer loop 替换了约 70 行手写 `pushFieldIfFilled` 块；
  `renderRelocationCombined` / `renderSponsorshipCombined` / `renderSkillsBody`
  跨字段视图删除（β.10f/i）。
- `JobUpdate` 扩到覆盖所有可编辑列。`wolf job set` 现在走单列 UPDATE，不再是
  全行 INSERT-OR-REPLACE（并发更安全 + SQL 更干净）。
- `workspace-claude.md` 瘦身：删除过时的 v1→v2 迁移段落 + 冗余的 JD 在磁盘
  段落；新增 job CLI 表面文档。


## v0.1.0 — 2026-04-28

首个稳定版发布到 npm：`npm i -g @gerryt/wolf`。Tailor 流水线（分析师 +
简历 + 求职信 writer，3-agent 检查点流程）是唯一端到端可用的特性。
`hunt` / `score` / `fill` / `reach` 已注册但会打印清晰的"未实现"提示并退出。

### 新增
- npm 稳定包 `@gerryt/wolf` 通过 `package.stable.json` + `scripts/publish-stable.sh`
  发布（根 `package.json` 是 dev workspace 清单，永不发布）。
- Dev 二进制 `wolf-dev`（与稳定版 `wolf` 分离），dogfood 稳定版的同时
  可以在同一台机器上迭代 dev。
- `update-notifier` 集成 —— 稳定版用户在新 `@gerryt/wolf` 发布时看到
  一行提示（24h 缓存；不阻塞用户命令）。
- Typed errors：`MissingApiKeyError`（`MISSING_API_KEY`）和
  `MissingChromiumError`（`MISSING_CHROMIUM`）。CLI 渲染为单行 stderr +
  exit 1（无 stack trace）。MCP 工具 handler 序列化为
  `{ isError: true, content: [{ text: JSON of { errorCode, ... } }] }`，
  AI orchestrator 可以根据 `errorCode` 分支。
- `assertApiKey()` 守卫 —— tailor 在调 Claude API 前调用，
  在让 SDK 抛 401 之前先暴露 missing-key 错误。
- Chromium 自动安装 —— render service 在首次 launch 时检测 Playwright
  Chromium 缺失，自动跑 `npx playwright install chromium`（进度流到用户
  terminal）。无询问，无 postinstall hook。
- `wolf doctor` 在原有 profile 检查之外报告 `WOLF_ANTHROPIC_API_KEY` 和
  Playwright Chromium 状态。
- `wolf --help` 中 `hunt` / `score` / `fill` / `reach` 标注
  `[NOT YET IMPLEMENTED — Mn]`，让用户看到路线图而不会意外。
- 根 `CLAUDE.md` 和 `AGENTS.md` 新增 `## Workspace migrations` 和
  `## Releasing (stable npm)` 两段。

### 变更
- `better-sqlite3`：`^11.9.1` → `^12.9.0`（覆盖更新的 Node 20–25 prebuild）。
- `playwright`：`devDependencies` → `dependencies`（render service 运行时
  导入 `chromium`）。
- README 重写：7 步「5 分钟」快速上手，明确包含填 profile 步骤；dev build
  说明改为新的 `wolf-dev` 二进制。

### Engines
- Node `>=20.0.0`（移除 Node 18 EOL 支持）。
