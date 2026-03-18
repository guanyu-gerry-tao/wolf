# wolf — 里程碑

---

## 里程碑 1 — 脚手架与骨架
> wolf 可作为 CLI 和 MCP 服务器运行，所有子命令已注册（stub 即可）

### 项目搭建
- [ ] 初始化 TypeScript + Node.js 项目结构
- [ ] 定义共享类型（`Job`、`Resume`、`AppConfig`）
- [ ] `wolf init` — 交互式设置向导（简历路径、目标职位、地点）
- [ ] 配置读写（`~/.wolf/config.json`）
- [ ] `.env` 处理 API key（Apify、Claude、Gmail）

### CLI 骨架
- [ ] 搭建 `commander.js` CLI 入口（`wolf`）
- [ ] 注册子命令：`wolf hunt`、`wolf tailor`、`wolf file`、`wolf reach`、`wolf status`（stub 即可）

### MCP 骨架
- [ ] MCP 服务器入口（`wolf mcp serve`）
- [ ] 注册 MCP tool：`wolf_hunt`、`wolf_tailor`、`wolf_file`、`wolf_reach`（stub 即可）
- [ ] 为所有 4 个 tool 定义类型化的输入/输出 schema
- [ ] 验证从 Claude Desktop / OpenClaw 的连接

---

## 里程碑 2 — 猎手
> wolf 可以从 LinkedIn 和 Handshake 搜索和评分职位

### `wolf hunt` / `wolf_hunt`
- [ ] Apify LinkedIn 爬虫集成
- [ ] Handshake 爬虫集成
- [ ] 跨来源结果去重
- [ ] 将原始 JD 结果保存到本地数据库（SQLite 或 JSON 文件）
- [ ] Claude API — 根据用户画像评分 JD 相关性（0.0–1.0）
- [ ] 按配置中的 `min_score` 过滤
- [ ] 标记职位：`new` / `reviewed` / `applied` / `rejected`
- [ ] 接入 MCP tool（替换 stub）

### `wolf status`
- [ ] 列出所有追踪的职位及其状态和分数
- [ ] 按 `--status`、`--score`、`--date` 过滤

---

## 里程碑 3 — 简历裁缝
> wolf 可以针对特定 JD 定制你的简历

### `wolf tailor` / `wolf_tailor`
- [ ] 从 `.tex` 源文件解析简历
- [ ] Claude API prompt — 根据 JD 关键词改写要点
- [ ] 输出定制简历为新的 `.tex` 文件 + 通过 `xelatex` 编译为 PDF
- [ ] 生成求职信为 `.md` 文件 + 通过 `md-to-pdf` 转换为 PDF
- [ ] 打印匹配分数和关键改动摘要
- [ ] `--diff` flag — 显示修改前后对比
- [ ] 接入 MCP tool（替换 stub）

---

## 里程碑 4 — 表单预填
> wolf 可以自动填写求职申请表

### `wolf file` / `wolf_file`
- [ ] Playwright 浏览器设置（headless + headed 模式）
- [ ] 表单字段检测（姓名、邮箱、简历上传、求职信等）
- [ ] 将用户资料数据映射到检测到的字段
- [ ] `wolf file --dry-run` — 打印检测到的字段，不提交
- [ ] `wolf file` — 实际填写并提交
- [ ] 完成后截图，用于审计追踪
- [ ] 处理常见边界情况（下拉菜单、复选框、文件上传）
- [ ] 接入 MCP tool（替换 stub）

---

## 里程碑 5 — 推广
> wolf 可以找到 HR 联系人并起草冷邮件

### `wolf reach` / `wolf_reach`
- [ ] 通过 Apify 进行 LinkedIn 人员搜索（按公司搜索招聘人员/招聘经理）
- [ ] 提取姓名、职位、邮箱（如有）
- [ ] 后备方案：生成可能的邮箱格式（`firstname.lastname@company.com`）
- [ ] Claude API prompt — 起草个性化冷邮件（语气可配置）
- [ ] 输出草稿到 `.md` 文件供审阅
- [ ] `--send` flag — 经用户确认后通过 Gmail API 发送
- [ ] Gmail API 集成（OAuth2，代用户发送）
- [ ] 接入 MCP tool（替换 stub）
