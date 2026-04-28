# 项目范围 — wolf

## wolf 是什么

**wolf**（**W**orkflow of **O**utreaching, **L**inkedIn & **F**illing）是一个 AI 驱动的求职 CLI 工具和 MCP 服务器。它自动化求职流程中重复性的环节——搜索职位、定制简历、填写申请表、发送 cold email——让你把精力集中在面试准备和技能提升上。

wolf 是一个**个人自动化工具**，而不是平台或服务。它在你的电脑上运行，数据存储在本地，只有在你主动操作时才会调用外部 API。

## 目标用户

寻找软件工程**实习或全职**职位的 **CS 学生**，需要满足以下条件：

- 主要使用 **LinkedIn** 和 **Handshake** 作为求职渠道
- 熟悉**终端**操作（能运行 `npm install`、编辑 `.env` 文件）
- 希望高效地大量投递，同时不牺牲申请质量
- 可能使用 AI 代理（如 OpenClaw）来编排整个求职工作流

## 范围内

### 职位发现（`wolf hunt`）

从多个来源搜索职位信息并保存到本地。

- **可插拔 provider 系统** — 通过 `JobProvider` 接口从任意来源接入职位数据
- 通过 Gmail API 解析**邮件提醒**（来自 LinkedIn、Handshake 等的职位提醒邮件）
- 通过 BrowserMCP 进行**浏览器辅助**提取（AI 驱动的页面导航）
- **手动输入** — 直接粘贴 JD 或 URL（`wolf hunt --manual`）

### 职位评分（`wolf hunt`）

使用 Claude API 进行 AI 驱动的相关性评分。

- 根据用户画像（技能、目标职位、地点）对每个职位进行 0.0–1.0 评分
- 要求每个评分附带理由（防止 AI 幻觉）
- 根据配置中的最低分数阈值过滤

### 简历定制（`wolf tailor`）

针对特定 JD 重写简历要点。

- 从 `resume_pool.md` 读取简历要点，从 `profile.md` 读取个人信息
- 通过 Claude API 进行 AI 重写，保持结构和真实性，使用 3-agent 流水线（分析师 → 简历 + 求职信 writer 并行）
- 输出 `resume.html` + 通过 Playwright Chromium 渲染 PDF，使用确定性 fit-loop（对 font-size / line-height / margin 做二分搜索以适配单页）
- 显示差异对比和最终 fit 参数

### Cover Letter 生成（`wolf tailor --cover-letter`）

为特定职位生成针对性的 cover letter。

- 通过 Claude API 生成，基于 JD + 用户画像 + 定制简历
- 输出为 `cover_letter.html` + 通过 Playwright Chromium 渲染 PDF（自然 CSS 布局，允许多页）。无系统级依赖。
- 语气和篇幅可配置

### 用户画像（`wolf init`）

收集并存储申请和外联所需的个人信息。

- **移民身份**（如美国公民、F-1 OPT、需要 H-1B 担保）
- **当前城市 / 是否愿意搬迁**
- **工作授权时间线**（如 OPT 开始日期、担保需求）
- **目标职位和地点**
- **技能和经验摘要**
- **联系方式**（姓名、邮箱、电话、LinkedIn URL）
- 存储在本地的 `wolf.toml`（工作区级别）以及每个 profile 文件夹下的三份 Markdown —— `profile.md` / `resume_pool.md` / `standard_questions.md` —— 加一个 `attachments/` 目录。除非你主动发起 API 调用，否则不会上传。
- 供 `wolf fill`（表单填写）、`wolf reach`（邮件起草）和 `wolf tailor`（简历上下文）使用

### 表单填写（`wolf fill`）

使用浏览器自动化填写求职申请表。

- 检测申请页面上的表单字段（Playwright）
- 将用户资料数据映射到表单字段
- 默认为预览模式（dry-run）；需要显式确认才能实际提交
- 提交后截图存档以供审计

### 外联（`wolf reach`）

查找招聘联系人并发送个性化 cold email。

- 按公司查找 HR 联系人（招聘人员、用人经理）
- 推断邮箱地址（firstname.lastname@company.com 模式）
- 通过 Claude API 生成个性化邮件草稿
- 通过 Gmail API 发送，需要显式 `--send` 标志 + 确认

### 求职追踪（`wolf status`）

在本地追踪申请状态。

- 状态生命周期：`new` → `reviewed` → `applied` / `rejected`
- 按状态、分数、日期过滤
- 所有数据存储在本地 SQLite — 可查询、可迁移、无云端依赖

### 双接口与外部编排

wolf 提供 CLI（commander.js）和 MCP 服务器（MCP SDK）双接口，共享相同的核心逻辑。设计理念是**被编排，而非自行编排**——OpenClaw、n8n、LangGraph 等外部工具可通过 CLI（`--json` 输出）或 MCP 驱动 wolf。架构细节和集成示例见 [ARCHITECTURE_zh.md § 外部编排集成](ARCHITECTURE_zh.md#外部编排集成)。

## 范围外

以下内容明确**不在** wolf 的目标范围内：

| 领域 | 原因 |
|---|---|
| **面试准备**（模拟面试、行为面试准备、LeetCode 刷题） | 属于不同的问题域；Pramp、Interviewing.io、Neetcode 等工具已经很成熟 |
| **薪资谈判**（offer 比较、谈判策略） | 需要超出求职自动化范围的专业知识 |
| **ATS 状态追踪**（追踪申请在雇主 ATS 系统中的状态变化） | 需要对接每个雇主的系统，且没有标准 API；wolf 只在本地追踪*你自己的*状态 |
| **社交关系管理**（联系人 CRM、跟进日程管理） | wolf 帮你找到联系人并发送外联邮件，但它不是 CRM |
| **作品集/个人网站生成** | 与求职申请无直接关系；已有大量专用工具 |
| **职位聚合服务** | wolf 是个人工具，不是服务多用户的平台 |
| **面试日程管理**（日历管理、时间协调） | 需要日历集成和实时协调，超出 wolf 的范围 |

## 平台与限制

| 维度 | 详情 |
|---|---|
| **运行时** | Node.js（TypeScript） |
| **操作系统** | macOS 和 Linux；Windows 支持不是优先级 |
| **数据存储** | 本地 SQLite 数据库（`data/wolf.sqlite`）；无云端同步 |
| **网络** | 仅在调用外部 API（Claude、Gmail 以及你配置的 provider API）时需要网络；核心的追踪和状态功能可离线使用 |

