# 验收标准 — wolf

格式：Given（前置条件）/ When（操作）/ Then（预期结果）。
每节对应一个用户故事和用例。

---

## AC-01 · 初始化配置（`wolf init`）

**故事：** US-01 · **用例：** UC-01.1.1, UC-01.1.2

**AC-01-1 — 正常流程**
- Given wolf 已安装且不存在 `wolf.toml`
- When 用户运行 `wolf init` 并完成所有提示
- Then `wolf.toml` 被写入工作区根目录，包含所有填写的个人资料字段

**AC-01-2 — 工作区确认**
- Given 用户提供的工作区路径已存在且包含文件
- When wolf 提示确认
- Then wolf 不会在用户明确确认之前继续执行

**AC-01-3 — API Key 状态摘要**
- Given 用户完成 `wolf init`
- When 向导结束
- Then wolf 始终打印每个 `WOLF_*` Key 的状态摘要（已设置/未设置），无论本次运行是否配置了 Key

**AC-01-4 — 简历池文件被打开**
- Given wolf 进入简历配置步骤
- When wolf 打开 `resume_pool.md`
- Then 文件在用户默认编辑器中打开；wolf 等待编辑器关闭后再继续

**AC-01-5 — 可脚本化的空初始化**
- Given 自动化 agent 需要一个非交互式 workspace
- When 它运行 `wolf init --empty`
- Then wolf 写入 schema-valid 的 `wolf.toml`、`profiles/default/profile.toml`、空的 `profiles/default/resume_pool.md` 和 `data/`，且不触发任何 prompt

**AC-01-6 — Dev 初始化隔离**
- Given dev build 以 `npm run wolf -- init --dev --empty` 调用
- When 设置了 `WOLF_DEV_HOME=/tmp/wolf-test/<suite>/<run-id>/workspaces/<workspace-id>`
- Then 所有 workspace 文件都创建在该测试 workspace 下，且 `wolf.toml` 包含 `[instance].mode = "dev"`

**AC-01-7 — Stable build 拒绝 dev workspace**
- Given 当前运行的是 stable build
- When 用户传入 `wolf init --dev`
- Then wolf 用清晰错误退出，提示用户在 clone 内运行 `npm run build:dev`

---

## AC-02 · 职位搜索（`wolf hunt`）

**故事：** US-02 · **用例：** UC-02.1.1, UC-02.1.2, UC-02.2.1, UC-02.2.2

**AC-02-1 — 职位保存到数据库**
- Given `wolf.toml` 中至少配置了一个数据源
- When 用户运行 `wolf hunt`
- Then 所有获取到的职位以 `status: raw`、`score: null` 保存到 SQLite

**AC-02-2 — 去重**
- Given 数据库中已存在某个相同 URL 的职位
- When `wolf hunt` 再次获取到同一职位
- Then 重复记录不被插入，已有记录保持不变

**AC-02-3 — 数据源故障隔离**
- Given 两个已配置数据源中的一个返回 HTTP 错误
- When `wolf hunt` 运行
- Then wolf 记录失败数据源的错误，并继续保存另一个成功数据源的结果

**AC-02-4 — 摘要输出**
- Given `wolf hunt` 完成
- When 打印结果
- Then 输出包含：共获取职位数、跳过重复数、保存新职位数

---

## AC-03 · 职位评分（`wolf score`）

**故事：** US-03 · **用例：** UC-03

**AC-03-1 — 评分被保存**
- Given 数据库中存在未评分的职位
- When `wolf score` 完成
- Then 所有通过硬性排除过滤的职位，其评分（0.0–1.0）均被保存到 SQLite

**AC-03-2 — 硬性排除过滤**
- Given 某职位要求提供签证担保，而用户个人资料表明无法满足
- When wolf 应用硬性排除规则
- Then 该职位被设置为 `status: filtered`，不出现在评分输出中

**AC-03-3 — 评分必须附带理由**
- Given Claude API 返回某个职位的评分结果
- When 解析该响应
- Then wolf 拒绝任何不包含理由字符串的评分结果

**AC-03-4 — 单条职位标志**
- Given 用户运行 `wolf score --single <jobId>`
- When 评分完成
- Then 仅对该职位进行同步评分，数据库立即更新

---

## AC-04 · 定制简历（`wolf tailor`）

**故事：** US-04 · **用例：** UC-04

**AC-04-1 — 输出文件已生成**
- Given 提供有效的 jobId 和 `.tex` 简历源文件
- When `wolf tailor <jobId>` 成功完成
- Then 工作区中生成了定制的 `.tex` 文件和编译后的 PDF

**AC-04-2 — 事实准确性保留**
- Given Claude 改写了简历要点
- When 检查输出内容
- Then 未引入原始简历中不存在的公司名称、日期、数据指标或技术声明
- AND 不杜撰 resume pool 中没有底层数据的整段 section（例如 Education / Skills / Projects）
- AND 生成的 resume 中 section 的顺序严格跟随 resume pool 里的顺序 —— writer 不得为了符合某种"惯例"（例如把 Experience 移到 Skills 前面）而重排 section

**AC-04-3 — 差异对比输出**
- Given 用户运行 `wolf tailor <jobId> --diff`
- When 定制完成
- Then 终端打印每个改动要点的前后对比

**AC-04-4 — 页数保护**
- Given 定制后的简历超过原始页数
- When 优化循环执行
- Then wolf 重新提示 Claude 缩短内容，直到页数与原始匹配

---

## AC-05 · 求职信生成（`wolf tailor --cover-letter`）

**故事：** US-05 · **用例：** UC-05

**AC-05-1 — 输出文件已生成**
- Given 提供有效的 jobId
- When `wolf tailor <jobId> --cover-letter` 完成
- Then 工作区中生成了 `.md` 求职信和 PDF，与定制简历并排存放

**AC-05-2 — 求职信引用职位描述**
- Given 职位描述中包含特定职位名称和公司名称
- When 求职信生成完毕
- Then 求职信中包含正确的职位名称和公司名称

**AC-05-3 — PDF 编译失败不阻断流程**
- Given `md-to-pdf` 未安装
- When 求职信生成运行
- Then wolf 保存 `.md` 文件，打印关于 PDF 编译的警告，并正常退出

---

## AC-06 · 表单填写（`wolf fill`）

**故事：** US-06 · **用例：** UC-06

**AC-06-1 — 试运行仅打印映射**
- Given 用户运行 `wolf fill <jobId> --dry-run`
- When wolf 分析表单
- Then 字段映射被打印到终端，不修改任何表单字段

**AC-06-2 — 正式填写更新职位状态**
- Given 用户运行 `wolf fill <jobId>`（无 dry-run）
- When 表单成功提交
- Then SQLite 中该职位的状态更新为 `applied`

**AC-06-3 — 截图已保存**
- Given `wolf fill` 完成（无论 dry-run 或正式）
- When 命令退出
- Then 工作区中保存了最终页面状态的截图

**AC-06-4 — 仅一次 Claude API 调用**
- Given wolf 检测到页面上的表单字段
- When 填写流程运行
- Then 字段映射仅调用一次 Claude API；后续填写操作完全以编程方式执行

**AC-06-5 — 简历上传已处理**
- Given 表单中包含简历文件上传字段
- When wolf 填写表单
- Then 使用 `setInputFiles()` 附加该职位对应的定制简历 PDF

---

## AC-07 · 主动外联（`wolf reach`）

**故事：** US-07 · **用例：** UC-07

**AC-07-1 — 发送前先保存草稿**
- Given 用户运行 `wolf reach <company>`
- When 草稿生成完毕
- Then 草稿以 `.md` 文件保存到工作区，并打印到终端，不执行任何发送操作

**AC-07-2 — 发送需要显式标志和确认**
- Given 用户运行 `wolf reach <company>`（无 `--send`）
- When 命令完成
- Then 不发送任何邮件；用户必须重新运行并加上 `--send` 标志，并确认提示

**AC-07-3 — 外联日志已记录**
- Given 用户确认并通过 `wolf reach --send` 发送邮件
- When Gmail API 返回成功
- Then 外联记录（公司、联系人邮箱、时间戳）被写入 SQLite

**AC-07-4 — 未找到邮箱时使用推断格式**
- Given 未找到联系人的邮箱地址
- When wolf 生成草稿
- Then wolf 使用推断的邮箱格式（如 `firstname.lastname@company.com`），并在终端输出中标注置信度

---

## AC-08 · 求职进度追踪（`wolf status` + `wolf job list`）

**故事：** US-08 · **用例：** UC-08

求职追踪拆成两个命令（见 DECISIONS.md 2026-04-18 · "Nouns over god-views"）。`wolf status` 是聚合仪表盘，永远不会随着新功能增长；`wolf job list` 负责带过滤的单条记录查询。

### `wolf status` —— 仪表盘汇总

**AC-08-1 — 计数器输出**
- Given 数据库中至少存在一条职位记录
- When 用户运行 `wolf status`
- Then 每个已注册的模块打印一行计数（如 `tracked`、`tailored`、`applied`），label 左对齐

**AC-08-2 — 容错聚合**
- Given 某一个计数器抛异常（例如该计数的 DB 查询失败）
- When 用户运行 `wolf status`
- Then 其他计数器仍正常打印；失败的那一行显示 `0 [error: ...]`，不会因为单点故障丢掉整个仪表盘

### `wolf job list` —— 过滤列表视图

遵循所有 `wolf <noun> list` 命令的统一形态 —— 见 DECISIONS.md 2026-04-18 · "Standard shape for `wolf <noun> list` commands"。

**AC-08-3 — 默认表格输出**
- Given 数据库中至少存在一条职位记录
- When 用户运行 `wolf job list`
- Then 打印包含以下列的表格：id（短）、公司、职位、状态、评分；默认显示 20 条

**AC-08-4 — 结构化过滤（AND 语义）**
- Given 用户运行 `wolf job list --status applied --min-score 0.7 --source LinkedIn`
- When 命令运行
- Then 仅显示同时满足三个结构化过滤的职位

**AC-08-5 — 搜索过滤**
- Given 用户运行 `wolf job list --search acme`
- When 命令运行
- Then 仅显示职位标题、公司名、或地点中（不区分大小写）包含 "acme" 子串的职位

**AC-08-6 — 可重复的 --search（OR 语义）**
- Given 用户运行 `wolf job list --search google --search apple`
- When 命令运行
- Then 匹配任一搜索词（标题、公司名、或地点）的职位都会显示 —— 多个 `--search` 在顶层做 OR

**AC-08-6b — 搜索与结构化过滤以 AND 组合**
- Given 用户运行 `wolf job list --search acme --status applied --min-score 0.7`
- When 命令运行
- Then 仅显示同时满足搜索 **以及** 每个结构化过滤的职位 —— 搜索 OR 组与每个结构化过滤在顶层用 AND 组合

**AC-08-6c — 搜索词按 SQL LIKE 模式处理，`%` / `_` 为通配符**
- Given 用户的 `--search <term>` 中包含 `%` 或 `_`
- When 命令运行
- Then `%` 匹配任意字符序列，`_` 匹配任意单个字符 —— 即 `--search "C_Dev"` 会命中 `CADev`、`C1Dev` 等；`--search "50%"` 会命中 `50`、`500`、`50abc` 等
- 这是**文档化行为**，不是 bug —— AI 调用方可以有意识地使用。人类调用方即使不知道通配符，最坏情况只会看到比预期更多的匹配，**不会**出现静默空集

**AC-08-7 — 时间范围**
- Given 用户运行 `wolf job list --start 2026-04-01 --end 2026-04-18`
- When 命令运行
- Then 仅显示 `createdAt` 落在两个日期之间（包含两端）的职位；非法日期产生清晰错误

**AC-08-8 — 溢出提示**
- Given 符合条件的总行数超过 limit
- When 命令运行
- Then 在表格下方打印 `... N more — use --limit <n> to see more`，N 为剩余条数

**AC-08-9 — 空状态提示**
- Given 没有任何职位匹配过滤条件（或数据库为空）
- When 用户运行 `wolf job list`
- Then wolf 打印 `No jobs match.`，而非空表格

**AC-08-10 — 机器可读输出**
- Given 用户运行 `wolf job list --json`
- When 命令运行
- Then wolf 打印完整结果对象的 pretty-printed JSON（jobs 数组加 `totalMatching`、`limited`）；不打印表格和溢出提示

**AC-08-11 — 非法输入会报错，而不是静默返回空**
- Given 用户运行 `wolf job list --status bogus`（或 `--min-score abc`、`--start not-a-date`、`--search ""`、`--limit 0`）
- When 命令运行
- Then wolf 抛清晰错误（列出合法 status，或指出具体有问题的 flag）；**不**静默返回零行

**AC-08-12 — 不提供 `--all`，不搜 JD 文本**
- Given 用户想 dump 全部行或搜 JD 文本
- When 用户找对应 flag
- Then 没有 `--all`（想看全部请用 `--limit <n>`）；JD 文本不通过 CLI 搜（想搜走 `grep -l X data/jobs/*/jd.md`）

---

## AC-09 · 环境变量管理（`wolf env`）

**故事：** US-09 · **用例：** UC-09

**AC-09-1 — Show 对 Key 值进行掩码处理**
- Given `WOLF_ANTHROPIC_API_KEY` 已在环境中设置
- When 用户运行 `wolf env show`
- Then 输出显示 Key 名称和掩码值（前 4 位 + 后 4 位），完整 Key 值不会被打印

**AC-09-2 — Show 标记未设置的 Key**
- Given `WOLF_APIFY_API_TOKEN` 未设置
- When 用户运行 `wolf env show`
- Then 该 Key 被标记为"未设置"，不报错

**AC-09-3 — Clear 移除 RC 文件中的配置行**
- Given `~/.zshrc` 中存在 `WOLF_*` 导出行
- When 用户运行 `wolf env clear`
- Then 这些行从 `~/.zshrc` 中被删除

**AC-09-4 — Clear 打印 unset 命令**
- Given `wolf env clear` 成功运行
- When 打印输出
- Then wolf 为每个已删除的 Key 打印 `unset WOLF_<KEY>` 命令，供用户在当前会话中执行

---

## AC-10 · Agent 驱动的工作流（MCP）

**故事：** US-10 · **用例：** UC-10

**AC-10-1 — `wolf_add` 返回 jobId**
- Given Agent 携带有效的 `{ title, company, jdText }` 数据
- When 调用 `wolf_add`
- Then wolf 保存职位并在响应中返回 `jobId`

**AC-10-2 — `wolf_tailor` 返回文件路径和截图**
- Given 提供有效的 jobId 且关联了职位描述
- When Agent 调用 `wolf_tailor`
- Then wolf 返回定制简历 PDF 路径和 PDF 的 base64 截图

**AC-10-3 — 所有工具返回结构化 JSON**
- Given 任意 MCP 工具调用
- When 工具完成（无论成功或失败）
- Then 响应符合该工具声明的输出 schema
