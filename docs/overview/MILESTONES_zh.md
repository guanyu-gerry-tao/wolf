# wolf — 里程碑

---

## 里程碑 1 — 脚手架与骨架
> wolf 可作为 CLI 和 MCP 服务器运行，所有子命令已注册（stub 即可）

### 项目搭建
- [x] 初始化 TypeScript + Node.js 项目结构
- [x] 定义共享类型（`Job`、`Resume`、`AppConfig`）
- [x] `wolf init` — 交互式设置向导（简历路径、目标职位、地点）
- [x] 配置读写（workspace 根目录下的 `wolf.toml`，通过 `wolf init` 创建）
- [x] API key 以 `WOLF_*` 环境变量形式存储；通过 `wolf env set/show/clear` 管理

### CLI 骨架
- [x] 搭建 `commander.js` CLI 入口（`wolf`）
- [x] 注册子命令：`wolf hunt`、`wolf score`、`wolf tailor`、`wolf fill`、`wolf reach`、`wolf status`（stub 即可）

### MCP 骨架
- [x] MCP 服务器入口（`wolf mcp serve`）
- [x] 注册 MCP tool：`wolf_hunt`、`wolf_score`、`wolf_tailor`、`wolf_fill`、`wolf_reach`（stub 即可）
- [x] 为所有 5 个 tool 定义类型化的输入/输出 schema
- [x] 验证从 Claude Desktop / OpenClaw 的连接

---

## 里程碑 2 — 猎手
> wolf 可以从任意配置来源接入并评分职位列表

### `wolf hunt` / `wolf_hunt`
- [ ] 可插拔 provider 系统 — 通过 `JobProvider` 接口从任意来源接入职位数据
- [ ] `ApiProvider` — 通用 HTTP provider，可从任意用户配置的 API 端点拉取数据
- [ ] 跨 provider 结果去重
- [ ] 将原始职位保存到本地数据库（SQLite），状态为 `raw`，评分为 `null`
- [ ] 接入 MCP tool（替换 stub）

### `wolf_add`（仅 MCP）
- [ ] 接收来自 AI 编排器的结构化职位数据 `{ title, company, jdText, url? }`
- [ ] 将职位存入数据库，状态为 `raw`，评分为 `null`；返回 `jobId`
- [ ] 无 CLI 对应命令 — AI 调用方（Claude/OpenClaw）负责从用户输入（截图、粘贴文本、URL）中提取结构

### `wolf score` / `wolf_score` — 已落地（纯 AI 打分，原方案已被替换）
- [x] 从数据库读取未评分职位（`score: null`）；`--jobs <ids>` 显式重打分时也接受。
- [x] 每个职位一次 AI 调用 —— 完整 profile（特别是 `scoring_notes`）+ JD 一起喂给打分 prompt；输出 `<score>0–10</score><justification>...</justification>` 解析后以 `[0.0, 1.0]` 存入 `Job.score`。
- [x] **不再做代码 dealbreaker** —— 改由 `scoring_notes` 的自由文字喂给 AI 处理。详见 DECISIONS.md 取代 §51 的条目。
- [x] Claude Batch API（默认）—— `BatchService.submitAiBatch`；`wolf score --poll` 拉结果并写回；通过 `batchItems.consumedAt` 保证幂等。
- [x] `--single` flag —— 同步走 Haiku 打分；返回 `singleScore` + `singleComment` 供 AI 编排器内联呈现。
- [x] HTTP 路由 `POST /api/score` 与 CLI 1:1 对齐。
- [ ] MCP tool `wolf_score` —— 暂停；目前 CLI + HTTP 已足够覆盖编排器入口。

### `wolf status`
- [ ] 列出所有追踪的职位及其状态和分数
- [ ] 按 `--status`、`--score`、`--date` 过滤

---

## 里程碑 3 — 简历裁缝
> wolf 可以针对特定 JD 定制你的简历

### `wolf tailor` / `wolf_tailor`
- [x] 从 `resume_pool.md` 读取简历要点，从 `profile.md` 读取个人信息
- [x] 3-agent 检查点流水线：分析师产出 `tailoring-brief.md`；简历 + 求职信 writer 并行执行
- [x] Claude API prompt — 根据 JD 改写简历要点和求职信 HTML
- [x] 输出 `resume.html` + 通过 Playwright Chromium 渲染 PDF，使用确定性 fit-loop（对 `--font-size` / `--line-height` / `--margin-in` 做二分搜索）
- [x] `--no-cover-letter` 跳过求职信 writer；`--hint` 通过 `hint.md` 给分析师传递引导
- [x] 打印最终 fit 参数和产物路径
- [x] `--diff` flag — 显示修改前后对比
- [x] 接入 MCP tool（替换 stub）

### `wolf cover-letter` / `wolf_cover_letter`
- [x] 在 tailor 流水线中并行生成求职信（分支 2b）
- [x] 检查 JD / `companies` 表是否有公司描述；若无则省略"为什么这家公司"段落
- [x] 输出 `cover_letter.html` + 通过 Playwright Chromium 渲染 PDF（自然 CSS 布局，允许多页）；路径写回 Job 行
- [x] 接入 MCP tool（替换 stub）

---

## 里程碑 4 — 表单预填
> wolf 可以自动填写求职申请表

### `wolf fill` / `wolf_fill`
- [ ] Playwright 浏览器设置（headless + headed 模式）
- [ ] 表单字段检测（姓名、邮箱、简历上传、求职信等）
- [ ] 将用户资料数据映射到检测到的字段
- [ ] `wolf fill --dry-run` — 打印检测到的字段，不提交
- [ ] `wolf fill` — 实际填写并提交
- [ ] 完成后截图，用于审计追踪
- [ ] 处理常见边界情况（下拉菜单、复选框、文件上传）
- [ ] 接入 MCP tool（替换 stub）

---

## 里程碑 5 — 推广
> wolf 可以找到 HR 联系人并起草冷邮件

### `wolf reach` / `wolf_reach`
- [ ] 查找 HR 联系人（按公司搜索招聘人员/招聘经理）
- [ ] 提取姓名、职位、邮箱（如有）
- [ ] 后备方案：生成可能的邮箱格式（`firstname.lastname@company.com`）
- [ ] Claude API prompt — 起草个性化冷邮件（语气可配置）
- [ ] 输出草稿到 `.md` 文件供审阅
- [ ] `--send` flag — 经用户确认后通过 Gmail API 发送
- [ ] Gmail API 集成（OAuth2，代用户发送）
- [ ] 接入 MCP tool（替换 stub）
